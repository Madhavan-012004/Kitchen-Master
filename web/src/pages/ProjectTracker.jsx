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

// Generate a consistent color from a name string
function nameToColor(name = '') {
    const colors = [
        '#6366f1', '#8b5cf6', '#ec4899', '#f97316',
        '#14b8a6', '#0ea5e9', '#22c55e', '#eab308'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
}

function StaffAvatar({ name, size = 28 }) {
    const bg = nameToColor(name);
    return (
        <div style={{
            width: size, height: size, borderRadius: '50%',
            background: bg, color: '#fff', fontWeight: 700,
            fontSize: size * 0.4, display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexShrink: 0,
            border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,0.15)'
        }}>
            {name?.charAt(0)?.toUpperCase()}
        </div>
    );
}

export default function ProjectTracker() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [columns, setColumns] = useState(COLUMNS);
    const [tasks, setTasks] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'medium', assigneeName: '', assigneeId: '' });
    const [employees, setEmployees] = useState([]);
    const [filterAssignee, setFilterAssignee] = useState('all'); // 'all' | assigneeName

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

    const fetchEmployees = async () => {
        try {
            const res = await api.get('/auth/employees');
            setEmployees(res.data.data?.employees || []);
        } catch (err) {
            console.error('Failed to fetch employees', err);
        }
    };

    useEffect(() => {
        fetchTasks();
        fetchEmployees();
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
            } catch (err) {
                alert('❌ Failed to update task status');
                fetchTasks();
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
            setShowModal(false);
            setNewTask({ title: '', description: '', priority: 'medium', assigneeName: '', assigneeId: '' });
            fetchTasks();
        } catch (err) {
            alert('❌ Failed to create task');
        }
    };

    const handleDeleteTask = async (id) => {
        if (!window.confirm('Delete this task?')) return;
        try {
            await api.delete(`/api/project-tasks/${id}`);
            fetchTasks();
        } catch (err) {
            alert('❌ Failed to delete task');
        }
    };

    // Filter columns by selected assignee
    const filteredColumns = React.useMemo(() => {
        if (filterAssignee === 'all') return columns;
        const result = {};
        Object.entries(columns).forEach(([colId, col]) => {
            result[colId] = {
                ...col,
                items: col.items.filter(item =>
                    item.assigneeName === filterAssignee
                )
            };
        });
        return result;
    }, [columns, filterAssignee]);

    // Collect all unique assignees from current tasks
    const assigneesInTasks = React.useMemo(() => {
        const names = new Set();
        Object.values(columns).forEach(col =>
            col.items.forEach(item => { if (item.assigneeName) names.add(item.assigneeName); })
        );
        return [...names];
    }, [columns]);

    if (isLoading) return <div className="pt-loading">Loading Tracker...</div>;

    return (
        <div className="pt-container">
            <div className="pt-header">
                <div className="pt-title-group">
                    <h1>Kanban Board</h1>
                    <span className="pt-badge">Manager/Owner Only</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button className="pt-add-btn" onClick={() => setShowModal(true)}>
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"></path></svg>
                        New Task
                    </button>
                </div>
            </div>

            {/* ── Create Task Modal ── */}
            {showModal && (
                <div className="pt-modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="pt-modal" onClick={e => e.stopPropagation()}>

                        {/* Header */}
                        <div className="pt-modal-head">
                            <div className="pt-modal-head-icon">
                                <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                            </div>
                            <div>
                                <h3 className="pt-modal-title">Create New Task</h3>
                                <p className="pt-modal-sub">Fill in the details below to add a task to the board</p>
                            </div>
                            <button className="pt-modal-close" onClick={() => setShowModal(false)} title="Close">
                                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="pt-modal-divider" />

                        <div className="pt-modal-body-split">
                            {/* Left Column */}
                            <div className="pt-modal-col-left">
                                {/* Task Title */}
                                <div className="pt-form-group">
                                    <label className="pt-field-label">
                                        <span className="pt-label-dot" style={{ background: '#6366f1' }} />
                                        Task Title <span className="pt-required">*</span>
                                    </label>
                                    <input
                                        className="pt-input"
                                        placeholder="e.g. Fix login bug, Prepare report..."
                                        value={newTask.title}
                                        onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                                        autoFocus
                                    />
                                </div>

                                {/* Description */}
                                <div className="pt-form-group" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                    <label className="pt-field-label">
                                        <span className="pt-label-dot" style={{ background: '#94a3b8' }} />
                                        Description <span className="pt-optional">(optional)</span>
                                    </label>
                                    <textarea
                                        className="pt-input pt-textarea"
                                        style={{ flex: 1 }}
                                        placeholder="Add more context about this task..."
                                        value={newTask.description}
                                        onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Right Column */}
                            <div className="pt-modal-col-right">
                                {/* Assign to Staff — avatar card grid */}
                                <div className="pt-form-group">
                                    <label className="pt-field-label">
                                        <span className="pt-label-dot" style={{ background: '#8b5cf6' }} />
                                        Assign to Staff <span className="pt-optional">(optional)</span>
                                    </label>
                                    <div className="pt-staff-grid">
                                        {/* Unassigned option */}
                                        <button
                                            type="button"
                                            className={`pt-staff-card ${newTask.assigneeName === '' ? 'selected' : ''}`}
                                            onClick={() => setNewTask({ ...newTask, assigneeName: '', assigneeId: '' })}
                                        >
                                            <div className="pt-staff-avatar-unassigned">
                                                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                            </div>
                                            <span className="pt-staff-card-name">None</span>
                                            {newTask.assigneeName === '' && <div className="pt-staff-selected-dot" />}
                                        </button>

                                        {employees.map(emp => (
                                            <button
                                                key={emp._id}
                                                type="button"
                                                className={`pt-staff-card ${newTask.assigneeName === emp.name ? 'selected' : ''}`}
                                                onClick={() => setNewTask({ ...newTask, assigneeName: emp.name, assigneeId: emp._id })}
                                                title={`${emp.name} — ${emp.role}`}
                                            >
                                                <StaffAvatar name={emp.name} size={38} />
                                                <span className="pt-staff-card-name">{emp.name.split(' ')[0]}</span>
                                                <span className="pt-staff-card-role">{emp.role}</span>
                                                {newTask.assigneeName === emp.name && <div className="pt-staff-selected-dot" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Priority — custom pill buttons */}
                                <div className="pt-form-group">
                                    <label className="pt-field-label">
                                        <span className="pt-label-dot" style={{ background: '#f59e0b' }} />
                                        Priority
                                    </label>
                                    <div className="pt-priority-pills">
                                        {[
                                            { val: 'low',    label: 'Low',    emoji: '🟢', color: '#059669', bg: 'rgba(16,185,129,0.1)', active: 'rgba(16,185,129,0.18)', border: '#10b981' },
                                            { val: 'medium', label: 'Medium', emoji: '🟡', color: '#d97706', bg: 'rgba(245,158,11,0.1)',  active: 'rgba(245,158,11,0.18)',  border: '#f59e0b' },
                                            { val: 'high',   label: 'High',   emoji: '🔴', color: '#e11d48', bg: 'rgba(244,63,94,0.1)',   active: 'rgba(244,63,94,0.18)',   border: '#f43f5e' },
                                        ].map(p => (
                                            <button
                                                key={p.val}
                                                type="button"
                                                className={`pt-priority-pill ${newTask.priority === p.val ? 'selected' : ''}`}
                                                style={{
                                                    '--pill-color': p.color,
                                                    '--pill-bg': p.bg,
                                                    '--pill-active': p.active,
                                                    '--pill-border': p.border,
                                                }}
                                                onClick={() => setNewTask({ ...newTask, priority: p.val })}
                                            >
                                                <span className="pt-pill-emoji">{p.emoji}</span>
                                                <span>{p.label}</span>
                                                {newTask.priority === p.val && (
                                                    <svg className="pt-pill-check" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-modal-divider" style={{ marginTop: '4px' }} />

                        {/* Actions */}
                        <div className="pt-modal-actions">
                            <button className="pt-cancel-btn" onClick={() => setShowModal(false)}>
                                Cancel
                            </button>
                            <button className="pt-save-btn" onClick={handleCreateTask}>
                                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                Save Task
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Staff Filter Bar ── */}
            <div className="pt-filter-bar">
                <span className="pt-filter-label">Filter by:</span>
                <button
                    className={`pt-filter-chip ${filterAssignee === 'all' ? 'active' : ''}`}
                    onClick={() => setFilterAssignee('all')}
                >
                    All Tasks
                </button>
                {assigneesInTasks.map(name => (
                    <button
                        key={name}
                        className={`pt-filter-chip ${filterAssignee === name ? 'active' : ''}`}
                        onClick={() => setFilterAssignee(filterAssignee === name ? 'all' : name)}
                    >
                        <StaffAvatar name={name} size={20} />
                        {name}
                    </button>
                ))}
            </div>

            <div className="pt-board">
                <DragDropContext onDragEnd={result => onDragEnd(result, columns, setColumns)}>
                    {Object.entries(filteredColumns).map(([columnId, column]) => {
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
                                                                                {item.assigneeName && (
                                                                                    <div className="pt-assignee-chip">
                                                                                        <StaffAvatar name={item.assigneeName} size={22} />
                                                                                        <span>{item.assigneeName}</span>
                                                                                    </div>
                                                                                )}
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
        </div>
    );
}

