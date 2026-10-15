# Tasks API

Simple REST API for managing tasks independently of Google Calendar integration.

## Endpoints

### GET /api/tasks.php
Retrieve all tasks.

**Response:**
```json
{
  "tasks": [
    {
      "id": "task_1234567890_5678",
      "text": "Task description",
      "done": false,
      "star": false,
      "created": "2026-05-30T12:34:56+00:00",
      "updated": "2026-05-30T12:34:56+00:00"
    }
  ]
}
```

### POST /api/tasks.php
Create a new task.

**Request body:**
```json
{
  "text": "New task description",
  "star": false
}
```

**Response:**
```json
{
  "id": "task_1234567890_5678",
  "text": "New task description",
  "done": false,
  "star": false,
  "created": "2026-05-30T12:34:56+00:00",
  "updated": "2026-05-30T12:34:56+00:00"
}
```

### PUT /api/tasks.php?id={taskId}
Update an existing task.

**Request body:**
```json
{
  "text": "Updated description",
  "done": true,
  "star": false
}
```

**Response:**
```json
{
  "success": true,
  "task": { ... }
}
```

### DELETE /api/tasks.php?id={taskId}
Delete a task.

**Response:**
```json
{
  "success": true
}
```

## Storage

Tasks are stored in a JSON file at `data/tasks.json`. The directory is created automatically on first use.

## CORS

The API includes CORS headers to allow cross-origin requests (useful for local development).

## Requirements

- PHP 5.6+
- Write permissions to the `data/` directory for the web server
