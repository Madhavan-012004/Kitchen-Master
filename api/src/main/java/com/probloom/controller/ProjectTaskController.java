package com.probloom.controller;

import com.probloom.model.entity.ProjectTask;
import com.probloom.repository.ProjectTaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/project-tasks")
@RequiredArgsConstructor
@SuppressWarnings("null")
public class ProjectTaskController {

    private final ProjectTaskRepository projectTaskRepository;

    // ── GET all tasks ──────────────────────────────────────────────────────────
    @GetMapping
    public ResponseEntity<?> getAll() {
        return ok("Tasks fetched", projectTaskRepository.findAll());
    }

    // ── POST create task ───────────────────────────────────────────────────────
    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        ProjectTask task = ProjectTask.builder()
                .title(str(body, "title"))
                .description(str(body, "description"))
                .status(strOrDefault(body, "status", "todo"))
                .priority(strOrDefault(body, "priority", "medium"))
                .assigneeName(str(body, "assigneeName"))
                .build();
        return ok("Task created", projectTaskRepository.save(task));
    }

    // ── PUT update task (status, title, priority, etc.) ───────────────────────
    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        ProjectTask task = projectTaskRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Task not found: " + id));

        if (body.containsKey("status"))
            task.setStatus(str(body, "status"));
        if (body.containsKey("title"))
            task.setTitle(str(body, "title"));
        if (body.containsKey("description"))
            task.setDescription(str(body, "description"));
        if (body.containsKey("priority"))
            task.setPriority(str(body, "priority"));
        if (body.containsKey("assigneeName"))
            task.setAssigneeName(str(body, "assigneeName"));

        return ok("Task updated", projectTaskRepository.save(task));
    }

    // ── DELETE task ────────────────────────────────────────────────────────────
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        if (!projectTaskRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        projectTaskRepository.deleteById(id);
        return ok("Task deleted", null);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────
    private String str(Map<String, Object> m, String key) {
        Object v = m.get(key);
        return v != null ? v.toString() : null;
    }

    private String strOrDefault(Map<String, Object> m, String key, String def) {
        Object v = m.get(key);
        return (v != null && !v.toString().isBlank()) ? v.toString() : def;
    }

    private ResponseEntity<Map<String, Object>> ok(String message, Object data) {
        Map<String, Object> b = new LinkedHashMap<>();
        b.put("success", true);
        b.put("message", message);
        if (data != null)
            b.put("data", data);
        return ResponseEntity.ok(b);
    }
}
