import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import axios from "axios";
import { FileExplorer } from '../components/FileExplorer';
import { TabView } from '../components/TabView';
import { CodeEditor } from '../components/CodeEditor';
import { BACKEND_URL } from '../config';
import { parseXml } from '../steps';
import { StepsList } from '../components/StepsList';
import { StepType, type FileItem, type Step } from '../types';
import { Loader } from '../components/Loader';
import { useWebContainer } from '../hooks/useWebcontainer';
import { PreviewFrame } from '../components/PreviewFrame';


export function Builder() {
    const location = useLocation();
    const { prompt } = location.state as { prompt: string };
    const [llmMessages, setLlmMessages] = useState<{
        role: "user" | "model",  // Gemini uses "model" instead of "assistant"
        parts: { text: string }[]
    }[]>([]);
    const [userPrompt, setPrompt] = useState("");
    const [templateSet, setTemplateSet] = useState(false);
    const [loading, setLoading] = useState(false);

    const [currentStep, setCurrentStep] = useState(1);
    const [activeTab, setActiveTab] = useState<'code' | 'preview'>('code');
    const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);

    const webcontainer = useWebContainer();

    const [steps, setSteps] = useState<Step[]>([]);
    const [files, setFiles] = useState<FileItem[]>([]);

    useEffect(() => {
        let originalFiles = [...files];
        let updateHappened = false;

        steps.filter(({ status }) => status === "pending").map(step => {
            updateHappened = true;
            if (step?.type === StepType.CreateFile) {
                let parsedPath = step.path?.split("/") ?? []; // {"src", "components", "App.tsx"}
                let currentFileStructure = [...originalFiles]; //{}
                let finalAnswerRef = currentFileStructure;

                let currentFolder = ""
                while (parsedPath.length) {
                    currentFolder = `${currentFolder}/${parsedPath[0]}`;
                    let currentFolderName = parsedPath[0];
                    parsedPath = parsedPath.slice(1);

                    if (!parsedPath.length) {
                        //finale file
                        let file = currentFileStructure.find(x => x.path === currentFolder)
                        if (!file) {
                            currentFileStructure.push({
                                name: currentFolder,
                                type: 'file',
                                path: currentFolder,
                                content: step.code
                            })
                        } else {
                            file.content = step.code;
                        }
                    } else {
                        // in a folder
                        let folder = currentFileStructure.find(x => x.path === currentFolder)
                        if (!folder) {
                            // create a folder
                            currentFileStructure.push({
                                name: currentFolderName,
                                type: 'folder',
                                path: currentFolder,
                                children: []
                            })
                        }

                        currentFileStructure = currentFileStructure.find(x => x.path === currentFolder)!.children!;
                    }
                }
                originalFiles = finalAnswerRef;
            }
        })

        if (updateHappened) {
            setFiles(originalFiles)
            setSteps(steps => steps.map((s: Step) => {
                return {
                    ...s,
                    status: "completed"
                }
            }))
        }
        console.log(files);

    }, [steps, files])

    useEffect(() => {
        const createMountStructure = (files: FileItem[]): Record<string, any> => {
            const mountStructure: Record<string, any> = {};

            const processFile = (file: FileItem, isRootFolder: boolean) => {
                if (file.type === 'folder') {
                    mountStructure[file.name] = {
                        directory: file.children ?
                            Object.fromEntries(
                                file.children.map(child => [child.name, processFile(child, false)])
                            )
                            : {}
                    };
                } else if (file.type === 'file') {
                    if (isRootFolder) {
                        mountStructure[file.name] = {
                            file: {
                                contents: file.content || ''
                            }
                        };
                    } else {
                        return {
                            file: {
                                contents: file.content || ''
                            }
                        };
                    }
                }
                return mountStructure[file.name];
            };

            files.forEach(file => processFile(file, true));
            return mountStructure;
        };

        const mountStructure = createMountStructure(files);
        console.log(mountStructure);
        webcontainer?.mount(mountStructure);

    }, [files, webcontainer])

    async function init() {
        const response = await axios.post(`${BACKEND_URL}/template`, {
            prompt: prompt.trim()
        });
        setTemplateSet(true);

        const { prompts, uiPrompts } = response.data;
setSteps(parseXml(uiPrompts?.[0] || "").map((x: Step) => ({
    ...x,
    status: "pending" as const
})));

        setLoading(true);
        const stepsResponse = await axios.post(`${BACKEND_URL}/chat`, {
            messages: [...prompts, prompt].map(x => ({
                role: "user",
                parts: [{ text: x }]
            }))
        })

        setLoading(false);

        setSteps(s => [...s, ...parseXml(stepsResponse.data.response).map(x => ({
            ...x,
            status: "pending" as "pending"
        }))]);

        setLlmMessages([...prompts, prompt].map(x => ({
            role: "user" as const,
            parts: [{ text: x }]
        })));
        setLlmMessages(x => [...x, {
            role: "model" as const,
            parts: [{ text: stepsResponse.data.response }]
        }]);
    }


    useEffect(() => {
        init();
    }, [])
    return (
        <div style={{
            minHeight: '100vh',
            backgroundColor: '#111827',
            display: 'flex',
            flexDirection: 'column'
        }}>
            <header style={{
                backgroundColor: '#1f2937',
                borderBottom: '1px solid #374151',
                padding: '1rem 1.5rem'
            }}>
                <h1 style={{
                    fontSize: '1.25rem',
                    fontWeight: '600',
                    color: '#f9fafb',
                    margin: '0'
                }}>
                    Website Builder
                </h1>
                <p style={{
                    fontSize: '0.875rem',
                    color: '#9ca3af',
                    marginTop: '0.25rem',
                    margin: '0.25rem 0 0 0'
                }}>
                    Prompt: {prompt}
                </p>
            </header>

            <div style={{ flex: '1', overflow: 'hidden' }}>
                <div style={{
                    height: '100%',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 2fr',
                    gap: '1.5rem',
                    padding: '1.5rem'
                }}>
                    {/* Steps Panel */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1.5rem',
                        overflowY: 'auto'
                    }}>
                        <div>
                            <div style={{
                                maxHeight: '75vh',
                                overflowY: 'scroll',
                                backgroundColor: '#1f2937',
                                borderRadius: '0.5rem',
                                padding: '1rem',
                                marginBottom: '1rem'
                            }}>
                                <StepsList
                                    steps={steps}
                                    currentStep={currentStep}
                                    onStepClick={setCurrentStep}
                                />
                            </div>

                            {/* Chat Interface */}
                            <div style={{
                                backgroundColor: '#1f2937',
                                borderRadius: '0.5rem',
                                padding: '1rem'
                            }}>
                                {(loading || !templateSet) ? (
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        padding: '2rem'
                                    }}>
                                        <Loader />
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <textarea
                                            value={userPrompt}
                                            onChange={(e) => setPrompt(e.target.value)}
                                            placeholder="Ask for changes or improvements..."
                                            style={{
                                                flex: '1',
                                                padding: '0.75rem',
                                                backgroundColor: '#111827',
                                                color: '#f9fafb',
                                                border: '1px solid #374151',
                                                borderRadius: '0.375rem',
                                                resize: 'vertical',
                                                minHeight: '4rem',
                                                fontSize: '0.875rem',
                                                fontFamily: 'inherit',
                                                outline: 'none'
                                            }}
                                            onFocus={(e) => {
                                                e.target.style.borderColor = '#3b82f6';
                                                e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                                            }}
                                            onBlur={(e) => {
                                                e.target.style.borderColor = '#374151';
                                                e.target.style.boxShadow = 'none';
                                            }}
                                        />
                                        <button
                                            onClick={async () => {
                                                const newMessage = {
                                                    role: "user" as const,
                                                    parts: [{ text: userPrompt }]
                                                };

                                                setLoading(true);
                                                const stepsResponse = await axios.post(`${BACKEND_URL}/chat`, {
                                                    messages: [...llmMessages, newMessage]
                                                });
                                                setLoading(false);

                                                setLlmMessages(x => [...x, newMessage]);
                                                setLlmMessages(x => [...x, {
                                                    role: "model" as const,
                                                    parts: [{ text: stepsResponse.data.response }]
                                                }]);

                                                setSteps(s => [...s, ...parseXml(stepsResponse.data.response).map(x => ({
                                                    ...x,
                                                    status: "pending" as const
                                                }))]);
                                            }}
                                            disabled={loading || !userPrompt.trim()}
                                            style={{
                                                backgroundColor: loading || !userPrompt.trim() ? '#6b7280' : '#8b5cf6',
                                                color: '#ffffff',
                                                padding: '0.75rem 1rem',
                                                borderRadius: '0.375rem',
                                                border: 'none',
                                                cursor: loading || !userPrompt.trim() ? 'not-allowed' : 'pointer',
                                                fontWeight: '500',
                                                fontSize: '0.875rem',
                                                transition: 'background-color 0.2s'
                                            }}
                                            onMouseEnter={(e) => {
                                                if (!loading && userPrompt.trim()) {
                                                    (e.target as HTMLButtonElement).style.backgroundColor = '#7c3aed';
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                if (!loading && userPrompt.trim()) {
                                                    (e.target as HTMLButtonElement).style.backgroundColor = '#8b5cf6';
                                                }
                                            }}
                                        >
                                            {loading ? 'Sending...' : 'Send'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* File Explorer Panel */}
                    <div style={{
                        backgroundColor: '#1f2937',
                        borderRadius: '0.5rem',
                        padding: '1rem',
                        height: 'calc(100vh - 8rem)',
                        overflowY: 'auto'
                    }}>
                        <h3 style={{
                            color: '#f9fafb',
                            fontSize: '1rem',
                            fontWeight: '600',
                            marginBottom: '1rem',
                            margin: '0 0 1rem 0'
                        }}>
                            Files
                        </h3>
                        <FileExplorer
                            files={files}
                            onFileSelect={setSelectedFile}
                        />
                    </div>

                    {/* Code/Preview Panel */}
                    <div style={{
                        backgroundColor: '#111827',
                        borderRadius: '0.5rem',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                        padding: '1rem',
                        height: 'calc(100vh - 8rem)',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        <TabView activeTab={activeTab} onTabChange={setActiveTab} />
                        <div style={{
                            flex: '1',
                            marginTop: '1rem',
                            overflow: 'hidden'
                        }}>
                            {activeTab === 'code' ? (
                                <CodeEditor file={selectedFile} />
                            ) : webcontainer ? (
                                <PreviewFrame webContainer={webcontainer} files={files} />
                            ) : (
                                <div style={{
                                    height: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#9ca3af'
                                }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{
                                            width: '2rem',
                                            height: '2rem',
                                            border: '2px solid #374151',
                                            borderTop: '2px solid #9ca3af',
                                            borderRadius: '50%',
                                            animation: 'spin 1s linear infinite',
                                            margin: '0 auto 0.5rem auto'
                                        }}></div>
                                        <p style={{ margin: '0' }}>Initializing preview...</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
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