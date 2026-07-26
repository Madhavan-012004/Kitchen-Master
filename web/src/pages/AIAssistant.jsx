import React, { useState, useEffect, useRef } from 'react';
import api from '../api/client.js';
import './AIAssistant.css';

const AIAssistant = () => {
    const [messages, setMessages] = useState([
        { role: 'assistant', content: 'Hello! I am your ProBloom Assistant. How can I help you manage your Shop today?' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, loading]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || loading) return;

        const userMsg = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setLoading(true);

        try {
            const res = await api.post('/ai/chat', { message: userMsg });
            if (res.data.success) {
                setMessages(prev => [...prev, { role: 'assistant', content: res.data.data.response }]);
            } else {
                setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
            }
        } catch (error) {
            setMessages(prev => [...prev, { role: 'assistant', content: 'I am having trouble connecting to my brain right now. Please check your connection.' }]);
        } finally {
            setLoading(false);
        }
    };

    // Simple Markdown / Table Renderer
    const renderContent = (content) => {
        if (!content) return null;

        // Detect tables
        if (content.includes('|') && content.includes('\n')) {
            const lines = content.split('\n');
            const tableLines = lines.filter(l => l.includes('|'));

            if (tableLines.length >= 2) {
                // This is a very basic table parser
                const rows = tableLines.filter(l => !l.includes('---'));
                return (
                    <div className="ai-table-container">
                        <table className="ai-response-table">
                            <thead>
                                <tr>
                                    {rows[0].split('|').filter(c => c.trim()).map((cell, i) => (
                                        <th key={i}>{cell.trim()}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.slice(1).map((row, i) => (
                                    <tr key={i}>
                                        {row.split('|').filter(c => c.trim()).map((cell, j) => (
                                            <td key={j}>{cell.trim()}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
            }
        }

        // Handle basic bolding and line breaks
        return content.split('\n').map((line, i) => {
            const parts = line.split(/(\*\*.*?\*\*)/g);
            return (
                <p key={i}>
                    {parts.map((part, j) => {
                        if (part.startsWith('**') && part.endsWith('**')) {
                            return <strong key={j}>{part.slice(2, -2)}</strong>;
                        }
                        return part;
                    })}
                </p>
            );
        });
    };

    return (
        <div className="ai-chat-page">
            <div className="ai-chat-container">
                <div className={`ai-chat-header ${messages.length > 1 ? 'minimized' : 'initial'}`}>
                    <div className="ai-avatar-glow">✨</div>
                    <div className="ai-header-info">
                        <h1>ProBloom Assistant</h1>
                    </div>
                </div>

                <div className="ai-messages-list">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`ai-message-wrapper ${msg.role}`}>
                            <div className="ai-message-avatar">
                                {msg.role === 'assistant' ? '✨' : '👤'}
                            </div>
                            <div className="ai-message-bubble">
                                {renderContent(msg.content)}
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <div className="ai-message-wrapper assistant">
                            <div className="ai-message-avatar">✨</div>
                            <div className="ai-message-bubble loading">
                                <div className="typing-dot"></div>
                                <div className="typing-dot"></div>
                                <div className="typing-dot"></div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <div className="ai-input-area">
                    <form onSubmit={handleSend} className="ai-input-form">
                        <input
                            type="text"
                            placeholder="Ask me anything about your Shop..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            disabled={loading}
                        />
                        <button type="submit" disabled={!input.trim() || loading}>
                            {loading ? '...' : '➤'}
                        </button>
                    </form>
                    <p className="ai-disclaimer">Assistant results can vary. Check important info.</p>
                </div>
            </div>
        </div>
    );
};

export default AIAssistant;
