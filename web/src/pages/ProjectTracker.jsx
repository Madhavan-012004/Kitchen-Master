import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useTranslation } from 'react-i18next';

import api from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';
import './ProjectTracker.css';

const COLUMNS = {
    todo: { name: 'To Do', items: [] },
    in_progress: { name: 'In Progress', items: [] },
    done: { name: 'Done', items: [] }
};

export default function ProjectTracker() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [columns, setColumns] = useState(COLUMNS);
    const [tasks, setTasks] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'medium', assigneeName: '' });

    // Restrict access
    if (user?.role !== 'owner' && user?.role !== 'manager') {
        return (
            <div className="pt-access-denied">
                <h2>Access Denied</h2>
                <p>Only Owners and Managers can view the Project Tracker.</p>
            </div>
        );
    }

    const fetchTasks = async () => {
        try {
            const res = await api.get('/api/project-tasks');
            // Backend returns { success: true, data: [...] } envelope
            const fetchedTasks = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
            setTasks(fetchedTasks);
            
            const newCols = {
                todo: { name: 'To Do', items: [] },
                in_progress: { name: 'In Progress', items: [] },
                done: { name: 'Done', items: [] }
            };
            
            fetchedTasks.forEach(task => {
                if (newCols[task.status]) {
                    newCols[task.status].items.push(task);
                } else {
                    newCols.todo.items.push(task);
                }
            });
            
            setColumns(newCols);
        } catch (error) {
            console.error('Failed to fetch tasks', error);
        } finally {
            setIsLoading(false);
        }
    };


    useEffect(() => {
        fetchTasks();
    }, []);

    const onDragEnd = async (result, columns, setColumns) => {
        if (!result.destination) return;
        const { source, destination } = result;

        if (source.droppableId !== destination.droppableId) {
            const sourceColumn = columns[source.droppableId];
            const destColumn = columns[destination.droppableId];
            const sourceItems = [...sourceColumn.items];
            const destItems = [...destColumn.items];
            const [removed] = sourceItems.splice(source.index, 1);
            destItems.splice(destination.index, 0, removed);

            setColumns({
                ...columns,
                [source.droppableId]: { ...sourceColumn, items: sourceItems },
                [destination.droppableId]: { ...destColumn, items: destItems }
            });

            try {
                await api.put(`/api/project-tasks/${removed.id}`, { status: destination.droppableId });
                // status updated silently
            } catch (err) {
                alert('❌ Failed to update task status');
                fetchTasks(); // revert on fail
            }
        } else {
            const column = columns[source.droppableId];
            const copiedItems = [...column.items];
            const [removed] = copiedItems.splice(source.index, 1);
            copiedItems.splice(destination.index, 0, removed);
            setColumns({
                ...columns,
                [source.droppableId]: { ...column, items: copiedItems }
            });
        }
    };

    const handleCreateTask = async () => {
        if (!newTask.title) { alert('Title is required'); return; }
        try {
            await api.post('/api/project-tasks', { ...newTask, status: 'todo' });
            // Task created
            setShowModal(false);
            setNewTask({ title: '', description: '', priority: 'medium', assigneeName: '' });
            fetchTasks();
        } catch (err) {
            alert('❌ Failed to create task');
        }
    };

    const handleDeleteTask = async (id) => {
        if (!window.confirm('Delete this task?')) return;
        try {
            await api.delete(`/api/project-tasks/${id}`);
            // deleted
            fetchTasks();
        } catch (err) {
            alert('❌ Failed to delete task');
        }
    };

    if (isLoading) return <div className="pt-loading">Loading Tracker...</div>;

    return (
        <div className="pt-container">
            <div className="pt-header">
                <div className="pt-title-group">
                    <h1>Kanban Board</h1>
                    <span className="pt-badge">Manager/Owner Only</span>
                </div>
                <button className="pt-add-btn" onClick={() => setShowModal(true)}>
                    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"></path></svg>
                    New Task
                </button>
            </div>

            <div className="pt-board">
                <DragDropContext onDragEnd={result => onDragEnd(result, columns, setColumns)}>
                    {Object.entries(columns).map(([columnId, column]) => {
                        return (
                            <div className="pt-column" key={columnId}>
                                <div className="pt-column-header">
                                    <h2>{column.name}</h2>
                                    <span className="pt-count">{column.items.length}</span>
                                </div>
                                <div style={{ margin: 8 }}>
                                    <Droppable droppableId={columnId} key={columnId}>
                                        {(provided, snapshot) => {
                                            return (
                                                <div
                                                    {...provided.droppableProps}
                                                    ref={provided.innerRef}
                                                    className={`pt-droppable ${snapshot.isDraggingOver ? 'drag-over' : ''}`}
                                                >
                                                    {column.items.map((item, index) => {
                                                        return (
                                                            <Draggable key={String(item.id)} draggableId={String(item.id)} index={index}>
                                                                {(provided, snapshot) => {
                                                                    return (
                                                                        <div
                                                                            ref={provided.innerRef}
                                                                            {...provided.draggableProps}
                                                                            {...provided.dragHandleProps}
                                                                            className={`pt-task-card ${snapshot.isDragging ? 'dragging' : ''} priority-${item.priority}`}
                                                                            style={{ ...provided.draggableProps.style }}
                                                                        >
                                                                            <div className="pt-task-header">
                                                                                <h4>{item.title}</h4>
                                                                                <button className="pt-delete-icon" onClick={() => handleDeleteTask(item.id)} title="Delete Task">
                                                                                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                                                                </button>
                                                                            </div>
                                                                            {item.description && <p className="pt-task-desc">{item.description}</p>}
                                                                            <div className="pt-task-footer">
                                                                                <span className={`pt-priority-badge ${item.priority}`}>{item.priority}</span>
                                                                                {item.assigneeName && <span className="pt-assignee">👤 {item.assigneeName}</span>}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                }}
                                                            </Draggable>
                                                        );
                                                    })}
                                                    {provided.placeholder}
                                                </div>
                                            );
                                        }}
                                    </Droppable>
                                </div>
                            </div>
                        );
                    })}
                </DragDropContext>
            </div>

            {showModal && (
                <div className="pt-modal-overlay">
                    <div className="pt-modal">
                        <h3>Create New Task</h3>
                        <input 
                            placeholder="Task Title" 
                            value={newTask.title}
                            onChange={e => setNewTask({...newTask, title: e.target.value})}
                        />
                        <textarea 
                            placeholder="Description" 
                            value={newTask.description}
                            onChange={e => setNewTask({...newTask, description: e.target.value})}
                        />
                        <div className="pt-modal-row">
                            <input 
                                placeholder="Assignee Name (optional)" 
                                value={newTask.assigneeName}
                                onChange={e => setNewTask({...newTask, assigneeName: e.target.value})}
                            />
                            <select 
                                value={newTask.priority}
                                onChange={e => setNewTask({...newTask, priority: e.target.value})}
                            >
                                <option value="low">Low Priority</option>
                                <option value="medium">Medium Priority</option>
                                <option value="high">High Priority</option>
                            </select>
                        </div>
                        <div className="pt-modal-actions">
                            <button className="pt-cancel-btn" onClick={() => setShowModal(false)}>Cancel</button>
                            <button className="pt-save-btn" onClick={handleCreateTask}>Save Task</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
