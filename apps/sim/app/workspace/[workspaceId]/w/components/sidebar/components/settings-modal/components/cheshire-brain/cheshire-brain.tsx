
'use client';

import { useEffect, useState } from 'react';
import { Brain, Activity, Zap, Layers, RefreshCw } from 'lucide-react';
import { Button, Input, Switch, Label, Badge } from '@/components/emcn';
// Assuming standard component library usage from surrounding code context

export function CheshireBrain() {
    const [config, setConfig] = useState<any>(null);
    const [actions, setActions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [projectId, setProjectId] = useState('default');

    useEffect(() => {
        fetchConfig();
        fetchActions();
    }, []);

    const fetchConfig = async () => {
        try {
            const res = await fetch('/api/cheshire/config');
            if (res.ok) setConfig(await res.json());
        } catch (e) {
            console.error("Failed to load config", e);
        }
    };

    const fetchActions = async () => {
        try {
            const res = await fetch('/api/cheshire/actions?limit=10');
            if (res.ok) {
                const data = await res.json();
                setActions(data.actions || []);
            }
        } catch (e) { console.error("Failed to load actions", e); }
        setLoading(false);
    };

    const updateConfig = async (key: string, value: any) => {
        // Optimistic update
        setConfig((prev: any) => ({ ...prev, [key]: value }));

        let body: any = {};
        if (key === 'allow_proactive') body.preferences = { allow_proactive: value };
        else body[key] = value;

        await fetch('/api/cheshire/config', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
    };

    if (loading) return <div className="p-8 text-center text-sm text-gray-500">Connecting to Cheshire...</div>;

    return (
        <div className="space-y-8 p-4">

            {/* HEADER */}
            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                    <Brain className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                    <h2 className="text-lg font-medium text-white">Cheshire Brain</h2>
                    <p className="text-sm text-gray-400">Orchestrate the cognitive layer of your platform.</p>
                </div>
            </div>

            {/* CONTROLS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* ORCHESTRATION / RHYTHM */}
                <div className="space-y-4 p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                    <div className="flex items-center gap-2 mb-2">
                        <Activity className="w-4 h-4 text-blue-400" />
                        <h3 className="text-sm font-medium text-white">Rhythm & Orchestration</h3>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <Label className="text-xs text-gray-400">Interaction Rhythm (Heartbeat)</Label>
                            <div className="flex items-center gap-4 mt-2">
                                <Input
                                    type="range"
                                    min="60000" max="604800000" step="60000"
                                    value={config?.interaction_rhythm_ms || 86400000}
                                    onChange={(e) => updateConfig('interaction_rhythm_ms', parseInt(e.target.value))}
                                    className="flex-1"
                                />
                                <span className="text-xs font-mono text-gray-300 w-24 text-right">
                                    {((config?.interaction_rhythm_ms || 86400000) / 3600000).toFixed(1)}h
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                                <Label className="text-sm text-white">Proactive Mode</Label>
                                <span className="text-xs text-gray-500">Allow Cheshire to initiate actions autonomously.</span>
                            </div>
                            <Switch
                                checked={config?.preferences?.allow_proactive}
                                onCheckedChange={(checked) => updateConfig('allow_proactive', checked)}
                            />
                        </div>
                    </div>
                </div>

                {/* PROJECT CONTEXT */}
                <div className="space-y-4 p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                    <div className="flex items-center gap-2 mb-2">
                        <Layers className="w-4 h-4 text-green-400" />
                        <h3 className="text-sm font-medium text-white">Project Context</h3>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <Label className="text-xs text-gray-400">Active Project Scope</Label>
                            <Input
                                value={projectId}
                                onChange={(e) => setProjectId(e.target.value)}
                                className="mt-2 bg-black/20 border-white/10 font-mono text-sm"
                                placeholder="e.g. hub-unibloom"
                            />
                            <p className="text-[10px] text-gray-500 mt-1">
                                Defines the memory partition the agent is currently accessing.
                            </p>
                        </div>
                    </div>
                </div>

            </div>

            {/* ACTION LOGS */}
            <div className="space-y-4 pt-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-yellow-400" />
                        <h3 className="text-sm font-medium text-white">Action Dispatcher Monitor</h3>
                    </div>
                    <Button variant="ghost" size="sm" onClick={fetchActions}>
                        <RefreshCw className="w-3 h-3" />
                    </Button>
                </div>

                <div className="border border-white/5 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-white/5 text-gray-400 font-medium">
                            <tr>
                                <th className="p-3">Status</th>
                                <th className="p-3">Type</th>
                                <th className="p-3">Trigger Content</th>
                                <th className="p-3 text-right">Time</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {actions.map((action) => (
                                <tr key={action.id} className="hover:bg-white/[0.02]">
                                    <td className="p-3">
                                        <Badge variant={action.status === 'EXECUTED' ? 'default' : action.status === 'FAILED' ? 'destructive' : 'secondary'}>
                                            {action.status}
                                        </Badge>
                                    </td>
                                    <td className="p-3 text-white font-mono">{action.action_type}</td>
                                    <td className="p-3 text-gray-400 max-w-[200px] truncate" title={action.trigger_content}>
                                        {action.trigger_content}
                                    </td>
                                    <td className="p-3 text-right text-gray-500">
                                        {new Date(action.created_at).toLocaleTimeString()}
                                    </td>
                                </tr>
                            ))}
                            {actions.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-gray-600 italic">
                                        No actions dispatched yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
}
