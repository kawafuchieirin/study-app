import json
import os
from datetime import date, datetime, timezone
from typing import Literal

import boto3
from fastapi import FastAPI, HTTPException, Request
from mangum import Mangum
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware

app = FastAPI(title="Manabi API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://manabi-study.k06en23.chatgpt.site",
        "http://localhost:3000",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["authorization", "content-type"],
)
table_name = os.getenv("TABLE_NAME", "manabi-items")
table = boto3.resource("dynamodb").Table(table_name)


class StudyTask(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    subject: str
    scheduled_for: datetime
    duration_minutes: int = Field(gt=0, le=480)


class TaskUpdate(BaseModel):
    completed: bool


class Reflection(BaseModel):
    content: str = Field(min_length=1, max_length=3000)
    mood: Literal["low", "okay", "good"]


class AiQuestion(BaseModel):
    subject: str
    question: str = Field(min_length=3, max_length=3000)
    learner_context: str = "高校生。答えだけでなく、考え方を段階的に知りたい。"


class StudyNote(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    subject: str = Field(min_length=1, max_length=60)
    content: str = Field(min_length=1, max_length=10000)
    tags: list[str] = Field(default_factory=list, max_length=10)


class Mistake(BaseModel):
    subject: str = Field(min_length=1, max_length=60)
    topic: str = Field(min_length=1, max_length=120)
    question: str = Field(min_length=1, max_length=3000)
    cause: str = Field(default="", max_length=1000)


class MistakeUpdate(BaseModel):
    mastered: bool


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


@app.get("/reflections")
def list_reflections(request: Request):
    user_id = current_user_id(request)
    response = table.query(
        KeyConditionExpression="pk = :pk AND begins_with(sk, :sk)",
        ExpressionAttributeValues={":pk": f"USER#{user_id}", ":sk": "REFLECTION#"},
        ScanIndexForward=False,
        Limit=30,
    )
    return {"items": response.get("Items", [])}


@app.put("/reflections/{reflection_date}")
def save_reflection(reflection_date: date, payload: Reflection, request: Request):
    user_id = current_user_id(request)
    timestamp = datetime.now(timezone.utc).isoformat()
    item = {
        "pk": f"USER#{user_id}",
        "sk": f"REFLECTION#{reflection_date.isoformat()}",
        "type": "reflection",
        "date": reflection_date.isoformat(),
        "content": payload.content,
        "mood": payload.mood,
        "updated_at": timestamp,
    }
    table.put_item(Item=item)
    return item


@app.get("/notes")
def list_notes(request: Request):
    user_id = current_user_id(request)
    response = table.query(
        KeyConditionExpression="pk = :pk AND begins_with(sk, :sk)",
        ExpressionAttributeValues={":pk": f"USER#{user_id}", ":sk": "NOTE#"},
        ScanIndexForward=False,
    )
    return {"items": response.get("Items", [])}


@app.post("/notes", status_code=201)
def create_note(payload: StudyNote, request: Request):
    user_id = current_user_id(request)
    timestamp = datetime.now(timezone.utc).isoformat()
    item = {"pk": f"USER#{user_id}", "sk": f"NOTE#{timestamp}", "type": "note", **payload.model_dump(), "updated_at": timestamp}
    table.put_item(Item=item)
    return item


@app.put("/notes/{note_id}")
def update_note(note_id: str, payload: StudyNote, request: Request):
    user_id = current_user_id(request)
    timestamp = datetime.now(timezone.utc).isoformat()
    item = {"pk": f"USER#{user_id}", "sk": note_id, "type": "note", **payload.model_dump(), "updated_at": timestamp}
    table.put_item(Item=item, ConditionExpression="attribute_exists(pk)")
    return item


@app.delete("/notes/{note_id}", status_code=204)
def delete_note(note_id: str, request: Request):
    user_id = current_user_id(request)
    table.delete_item(Key={"pk": f"USER#{user_id}", "sk": note_id})


@app.get("/mistakes")
def list_mistakes(request: Request):
    user_id = current_user_id(request)
    response = table.query(
        KeyConditionExpression="pk = :pk AND begins_with(sk, :sk)",
        ExpressionAttributeValues={":pk": f"USER#{user_id}", ":sk": "MISTAKE#"},
        ScanIndexForward=False,
    )
    return {"items": response.get("Items", [])}


@app.post("/mistakes", status_code=201)
def create_mistake(payload: Mistake, request: Request):
    user_id = current_user_id(request)
    timestamp = datetime.now(timezone.utc).isoformat()
    item = {"pk": f"USER#{user_id}", "sk": f"MISTAKE#{timestamp}", "type": "mistake", **payload.model_dump(), "mastered": False, "updated_at": timestamp}
    table.put_item(Item=item)
    return item


@app.patch("/mistakes/{mistake_id}")
def update_mistake(mistake_id: str, payload: MistakeUpdate, request: Request):
    user_id = current_user_id(request)
    response = table.update_item(
        Key={"pk": f"USER#{user_id}", "sk": mistake_id},
        UpdateExpression="SET mastered = :mastered, updated_at = :updated_at",
        ExpressionAttributeValues={":mastered": payload.mastered, ":updated_at": datetime.now(timezone.utc).isoformat()},
        ConditionExpression="attribute_exists(pk)",
        ReturnValues="ALL_NEW",
    )
    return response["Attributes"]


@app.delete("/mistakes/{mistake_id}", status_code=204)
def delete_mistake(mistake_id: str, request: Request):
    user_id = current_user_id(request)
    table.delete_item(Key={"pk": f"USER#{user_id}", "sk": mistake_id})


@app.get("/ai/history")
def ai_history(request: Request):
    user_id = current_user_id(request)
    response = table.query(
        KeyConditionExpression="pk = :pk AND begins_with(sk, :sk)",
        ExpressionAttributeValues={":pk": f"USER#{user_id}", ":sk": "AI#"},
        ScanIndexForward=False,
        Limit=20,
    )
    return {"items": response.get("Items", [])}


@app.post("/ai/explain")
def explain(payload: AiQuestion, request: Request):
    user_id = current_user_id(request)
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
    timestamp = datetime.now(timezone.utc).isoformat()
    item = {"pk": f"USER#{user_id}", "sk": f"AI#{timestamp}", "type": "ai", "subject": payload.subject, "question": payload.question, "answer": answer, "created_at": timestamp}
    table.put_item(Item=item)
    return item


handler = Mangum(app)
