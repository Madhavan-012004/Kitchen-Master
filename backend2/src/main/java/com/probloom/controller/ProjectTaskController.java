package com.probloom.controller;

import com.probloom.model.entity.ProjectTask;
import com.probloom.repository.ProjectTaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

@RestController
@RequestMapping("/api/project-tasks")
@RequiredArgsConstructor
public class ProjectTaskController {

    private final ProjectTaskRepository projectTaskRepository;

    @GetMapping
    public ResponseEntity<?> getAll() {
        return ok("Tasks fetched", projectTaskRepository.findAll());
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        ProjectTask task = ProjectTask.builder()
                .title((String) body.get("title"))
                .status((String) body.getOrDefault("status", "TODO"))
                .build();
        return ok("Task created", projectTaskRepository.save(Objects.requireNonNull(task)));
    }

    private ResponseEntity<Map<String, Object>> ok(String message, Object data) {
        Map<String, Object> b = new LinkedHashMap<>();
        b.put("success", true);
        b.put("message", message);
        if (data != null) b.put("data", data);
        return ResponseEntity.ok(b);
    }
}
