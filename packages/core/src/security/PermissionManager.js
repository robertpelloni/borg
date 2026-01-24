export class PermissionManager {
    autonomyLevel;
    constructor(autonomyLevel = 'high') {
        this.autonomyLevel = autonomyLevel;
    }
    setAutonomyLevel(level) {
        this.autonomyLevel = level;
    }
    getAutonomyLevel() {
        return this.autonomyLevel;
    }
    /**
     * Determines if a tool call requires user approval.
     */
    checkPermission(toolName, args) {
        // High Autonomy: Trust completely
        if (this.autonomyLevel === 'high') {
            return 'APPROVED';
        }
        const risk = this.assessRisk(toolName, args);
        if (this.autonomyLevel === 'medium') {
            // Medium: Allow low/medium, consult on high
            if (risk === 'high')
                return 'NEEDS_CONSULTATION';
            return 'APPROVED';
        }
        // Low Autonomy: Block high, consult on medium, allow low
        if (risk === 'high')
            return 'DENIED';
        if (risk === 'medium')
            return 'NEEDS_CONSULTATION';
        return 'APPROVED';
    }
    assessRisk(toolName, args) {
        // High Risk Tools (Modifying system, network, sensitive reads)
        if (toolName.includes('write_file') ||
            toolName.includes('execute_command') ||
            toolName.includes('install') ||
            toolName.includes('git_push')) {
            // Nuance: 'ls' or 'echo' via execute_command might be low risk, 
            // but for now, we treat shell exec as high risk in low-autonomy mode.
            return 'high';
        }
        // Medium Risk (Read-only but potentially sensitive, or minor mods)
        if (toolName.includes('read_file') || toolName.includes('list_directory') || toolName.includes('read_page')) {
            return 'medium';
        }
        // Low Risk (Info, search, ping)
        if (toolName.includes('search') || toolName.includes('status') || toolName.includes('ping')) {
            return 'low';
        }
        // Default to high risk for unknown tools
        return 'high';
    }
}
