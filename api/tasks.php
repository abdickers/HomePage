<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$dataDir = __DIR__ . '/../data';
$tasksFile = $dataDir . '/tasks.json';

// Ensure data directory exists
if (!is_dir($dataDir)) {
    mkdir($dataDir, 0755, true);
}

// Initialize tasks file if it doesn't exist
if (!file_exists($tasksFile)) {
    file_put_contents($tasksFile, json_encode([]));
}

function getTasks() {
    global $tasksFile;
    $content = file_get_contents($tasksFile);
    return json_decode($content, true) ?: [];
}

function saveTasks($tasks) {
    global $tasksFile;
    file_put_contents($tasksFile, json_encode($tasks, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
    return true;
}

function generateId() {
    return 'task_' . time() . '_' . rand(1000, 9999);
}

$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$pathParts = explode('/', trim($path, '/'));

try {
    if ($method === 'GET') {
        // GET /api/tasks or /api/tasks/{id}
        $tasks = getTasks();
        
        if (count($pathParts) > 2 && $pathParts[2] !== 'tasks') {
            // Getting a specific task
            $taskId = $pathParts[2];
            $task = array_filter($tasks, function($t) use ($taskId) {
                return $t['id'] === $taskId;
            });
            
            if (empty($task)) {
                http_response_code(404);
                echo json_encode(['error' => 'Task not found']);
            } else {
                echo json_encode(array_values($task)[0]);
            }
        } else {
            // Get all tasks
            echo json_encode(['tasks' => $tasks]);
        }
    }
    
    else if ($method === 'POST') {
        // POST /api/tasks - Create new task
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (empty($input['text'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Task text is required']);
            exit;
        }
        
        $tasks = getTasks();
        $newTask = [
            'id' => generateId(),
            'text' => trim($input['text']),
            'done' => false,
            'star' => $input['star'] ?? false,
            'created' => date('c'),
            'updated' => date('c')
        ];
        
        $tasks[] = $newTask;
        saveTasks($tasks);
        
        http_response_code(201);
        echo json_encode($newTask);
    }
    
    else if ($method === 'PUT') {
        // PUT /api/tasks/{id} - Update task
        $taskId = $pathParts[count($pathParts) - 1];
        $input = json_decode(file_get_contents('php://input'), true);
        
        $tasks = getTasks();
        $updated = false;
        
        foreach ($tasks as &$task) {
            if ($task['id'] === $taskId) {
                if (isset($input['text'])) {
                    $task['text'] = trim($input['text']);
                }
                if (isset($input['done'])) {
                    $task['done'] = (bool)$input['done'];
                }
                if (isset($input['star'])) {
                    $task['star'] = (bool)$input['star'];
                }
                $task['updated'] = date('c');
                $updated = true;
                break;
            }
        }
        
        if (!$updated) {
            http_response_code(404);
            echo json_encode(['error' => 'Task not found']);
            exit;
        }
        
        saveTasks($tasks);
        echo json_encode(['success' => true, 'task' => end($tasks)]);
    }
    
    else if ($method === 'DELETE') {
        // DELETE /api/tasks/{id} - Delete task
        $taskId = $pathParts[count($pathParts) - 1];
        
        $tasks = getTasks();
        $initialCount = count($tasks);
        $tasks = array_filter($tasks, function($task) use ($taskId) {
            return $task['id'] !== $taskId;
        });
        
        if (count($tasks) === $initialCount) {
            http_response_code(404);
            echo json_encode(['error' => 'Task not found']);
            exit;
        }
        
        saveTasks($tasks);
        echo json_encode(['success' => true]);
    }
    
    else {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>
