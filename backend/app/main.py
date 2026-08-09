import json
import os
from datetime import date, datetime, timezone
from typing import Literal

import boto3
from fastapi import FastAPI, HTTPException, Request
from mangum import Mangum
from pydantic import BaseModel, Field

app = FastAPI(title="Manabi API", version="0.1.0")
table_name = os.getenv("TABLE_NAME", "manabi-items")
table = boto3.resource("dynamodb").Table(table_name)


class StudyTask(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    subject: str
    scheduled_for: datetime
    duration_minutes: int = Field(gt=0, le=480)


class TaskUpdate(BaseModel):
    completed: bool


class AiQuestion(BaseModel):
    user_id: str
    subject: str
    question: str = Field(min_length=3, max_length=3000)
    learner_context: str = "高校生。答えだけでなく、考え方を段階的に知りたい。"


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/users/{user_id}/dashboard")
def dashboard(user_id: str):
    response = table.query(KeyConditionExpression="pk = :pk", ExpressionAttributeValues={":pk": f"USER#{user_id}"})
    return {"items": response.get("Items", [])}


def current_user_id(request: Request) -> str:
    try:
        return request.scope["aws.event"]["requestContext"]["authorizer"]["jwt"]["claims"]["sub"]
    except KeyError as exc:
        raise HTTPException(status_code=401, detail="ログインが必要です") from exc


@app.get("/tasks")
def list_tasks(request: Request):
    user_id = current_user_id(request)
    response = table.query(
        KeyConditionExpression="pk = :pk AND begins_with(sk, :sk)",
        ExpressionAttributeValues={":pk": f"USER#{user_id}", ":sk": "TASK#"},
        ScanIndexForward=True,
    )
    return {"items": response.get("Items", [])}


@app.post("/tasks", status_code=201)
def create_task(task: StudyTask, request: Request):
    user_id = current_user_id(request)
    timestamp = datetime.now(timezone.utc).isoformat()
    item = {"pk": f"USER#{user_id}", "sk": f"TASK#{timestamp}", "type": "task", **task.model_dump(mode="json"), "completed": False}
    table.put_item(Item=item)
    return item


@app.patch("/tasks/{task_id}")
def update_task(task_id: str, payload: TaskUpdate, request: Request):
    user_id = current_user_id(request)
    response = table.update_item(
        Key={"pk": f"USER#{user_id}", "sk": task_id},
        UpdateExpression="SET completed = :completed",
        ExpressionAttributeValues={":completed": payload.completed},
        ConditionExpression="attribute_exists(pk)",
        ReturnValues="ALL_NEW",
    )
    return response["Attributes"]


@app.delete("/tasks/{task_id}", status_code=204)
def delete_task(task_id: str, request: Request):
    user_id = current_user_id(request)
    table.delete_item(Key={"pk": f"USER#{user_id}", "sk": task_id})


@app.post("/ai/explain")
def explain(payload: AiQuestion):
    prompt = f"""あなたは高校生向けの学習コーチです。答えを直接与える前に、考え方を3段階で説明してください。
科目: {payload.subject}
学習者情報: {payload.learner_context}
質問: {payload.question}
最後に理解確認の短い類題を1問だけ作ってください。"""
    client = boto3.client("bedrock-runtime")
    try:
        response = client.converse(modelId=os.getenv("BEDROCK_MODEL_ID", "amazon.nova-lite-v1:0"), messages=[{"role": "user", "content": [{"text": prompt}]}], inferenceConfig={"maxTokens": 1000, "temperature": 0.3})
        answer = response["output"]["message"]["content"][0]["text"]
    except Exception as exc:
        raise HTTPException(status_code=502, detail="AI解説を生成できませんでした") from exc
    return {"answer": answer}


handler = Mangum(app)
