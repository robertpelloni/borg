import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ClipboardList, Lightbulb, CheckSquare, Gavel } from 'lucide-react';

export interface CompactedContext {
    summary: string;
    facts: string[];
    decisions: string[];
    actionItems: string[];
}

interface ContextViewerProps {
    context: CompactedContext;
    className?: string;
}

export function ContextViewer({ context, className }: ContextViewerProps) {
    if (!context) return null;

    return (
        <Card className={`w-full ${className}`}>
            <CardHeader className="pb-3">
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-blue-400" />
                    Context Summary
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Summary Section */}
                <div>
                    <h4 className="text-sm font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Overview</h4>
                    <p className="text-sm text-foreground/90 leading-relaxed bg-muted/30 p-2 rounded-md border border-border/50">
                        {context.summary || "No summary available."}
                    </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    {/* Facts */}
                    <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-blue-400 flex items-center gap-1 uppercase tracking-wider">
                            <Lightbulb className="h-3 w-3" /> Facts
                        </h4>
                        <ScrollArea className="h-[120px] w-full rounded-md border p-2 bg-muted/20">
                            {context.facts.length > 0 ? (
                                <ul className="space-y-1">
                                    {context.facts.map((fact, i) => (
                                        <li key={i} className="text-xs text-muted-foreground flex gap-2 items-start">
                                            <span className="mt-1 h-1 w-1 rounded-full bg-blue-500 shrink-0" />
                                            {fact}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-xs text-muted-foreground italic">No facts extracted.</p>
                            )}
                        </ScrollArea>
                    </div>

                    {/* Decisions */}
                    <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-purple-400 flex items-center gap-1 uppercase tracking-wider">
                            <Gavel className="h-3 w-3" /> Decisions
                        </h4>
                        <ScrollArea className="h-[120px] w-full rounded-md border p-2 bg-muted/20">
                            {context.decisions.length > 0 ? (
                                <ul className="space-y-1">
                                    {context.decisions.map((decision, i) => (
                                        <li key={i} className="text-xs text-muted-foreground flex gap-2 items-start">
                                            <span className="mt-1 h-1 w-1 rounded-full bg-purple-500 shrink-0" />
                                            {decision}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-xs text-muted-foreground italic">No decisions made.</p>
                            )}
                        </ScrollArea>
                    </div>

                    {/* Action Items */}
                    <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-green-400 flex items-center gap-1 uppercase tracking-wider">
                            <CheckSquare className="h-3 w-3" /> Actions
                        </h4>
                        <ScrollArea className="h-[120px] w-full rounded-md border p-2 bg-muted/20">
                            {context.actionItems.length > 0 ? (
                                <ul className="space-y-1">
                                    {context.actionItems.map((item, i) => (
                                        <li key={i} className="text-xs text-muted-foreground flex gap-2 items-start">
                                            <span className="mt-1 h-1 w-1 rounded-full bg-green-500 shrink-0" />
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-xs text-muted-foreground italic">No action items.</p>
                            )}
                        </ScrollArea>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
