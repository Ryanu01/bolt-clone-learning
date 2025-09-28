import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wand2 } from 'lucide-react';

export function Home() {
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if(prompt.trim()) {
            setIsLoading(true);
            // Simulate processing time for better UX
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Navigate to builder with the prompt
            navigate('/builder', { state: { prompt } });
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #1f2937 0%, #374151 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
        }}>
            <div style={{ maxWidth: '42rem', width: '100%' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ 
                        display: 'flex', 
                        justifyContent: 'center', 
                        marginBottom: '1rem' 
                    }}>
                        <Wand2 style={{ 
                            width: '3rem', 
                            height: '3rem', 
                            color: '#60a5fa' 
                        }} />
                    </div>
                    <h1 style={{
                        fontSize: '2.25rem',
                        fontWeight: 'bold',
                        color: '#f9fafb',
                        marginBottom: '1rem',
                        margin: '0 0 1rem 0'
                    }}>
                        Website Builder AI
                    </h1>
                    <p style={{
                        fontSize: '1.125rem',
                        color: '#d1d5db',
                        margin: '0'
                    }}>
                        Describe your dream website, and we'll help you build it step by step
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{
                        backgroundColor: '#374151',
                        borderRadius: '0.5rem',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                        padding: '1.5rem'
                    }}>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Describe the website you want to build..."
                            disabled={isLoading}
                            style={{
                                width: '100%',
                                height: '8rem',
                                padding: '1rem',
                                backgroundColor: '#1f2937',
                                color: '#f9fafb',
                                border: '1px solid #4b5563',
                                borderRadius: '0.5rem',
                                resize: 'none',
                                fontSize: '1rem',
                                fontFamily: 'inherit',
                                outline: 'none',
                                transition: 'border-color 0.2s, box-shadow 0.2s',
                                boxSizing: 'border-box'
                            }}
                            onFocus={(e) => {
                                e.target.style.borderColor = '#3b82f6';
                                e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                            }}
                            onBlur={(e) => {
                                e.target.style.borderColor = '#4b5563';
                                e.target.style.boxShadow = 'none';
                            }}
                        />
                        <button
                            type="submit"
                            disabled={isLoading || !prompt.trim()}
                            style={{
                                width: '100%',
                                marginTop: '1rem',
                                backgroundColor: isLoading || !prompt.trim() ? '#6b7280' : '#2563eb',
                                color: '#f9fafb',
                                padding: '0.75rem 1.5rem',
                                borderRadius: '0.5rem',
                                fontWeight: '500',
                                border: 'none',
                                cursor: isLoading || !prompt.trim() ? 'not-allowed' : 'pointer',
                                fontSize: '1rem',
                                transition: 'background-color 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem'
                            }}
                            onMouseEnter={(e) => {
                                if (!isLoading && prompt.trim()) {
                                    (e.target as HTMLButtonElement).style.backgroundColor = '#1d4ed8';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isLoading && prompt.trim()) {
                                    (e.target as HTMLButtonElement).style.backgroundColor = '#2563eb';
                                }
                            }}
                        >
                            {isLoading ? (
                                <>
                                    <div style={{
                                        width: '1rem',
                                        height: '1rem',
                                        border: '2px solid #374151',
                                        borderTop: '2px solid #f9fafb',
                                        borderRadius: '50%',
                                        animation: 'spin 1s linear infinite'
                                    }}></div>
                                    Generating Plan...
                                </>
                            ) : (
                                'Generate Website Plan'
                            )}
                        </button>
                    </div>
                </form>
            </div>

            <style>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}