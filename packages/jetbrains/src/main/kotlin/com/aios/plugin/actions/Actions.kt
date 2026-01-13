package com.aios.plugin.actions

import com.aios.plugin.AiosService
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.ui.Messages

class ConnectAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val service = project.getService(AiosService::class.java)
        
        val url = Messages.showInputDialog(
            project,
            "Enter AIOS Hub URL:",
            "Connect to AIOS Hub",
            null,
            "http://localhost:3000",
            null
        ) ?: return
        
        service.setHubUrl(url)
        if (service.connect()) {
            notify(project, "Connected to AIOS Hub", NotificationType.INFORMATION)
        } else {
            notify(project, "Failed to connect to AIOS Hub", NotificationType.ERROR)
        }
    }
    
    private fun notify(project: com.intellij.openapi.project.Project, message: String, type: NotificationType) {
        NotificationGroupManager.getInstance()
            .getNotificationGroup("AIOS Notifications")
            .createNotification(message, type)
            .notify(project)
    }
}

class DisconnectAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val service = project.getService(AiosService::class.java)
        service.disconnect()
        
        NotificationGroupManager.getInstance()
            .getNotificationGroup("AIOS Notifications")
            .createNotification("Disconnected from AIOS Hub", NotificationType.INFORMATION)
            .notify(project)
    }
}

class StartDebateAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val editor = e.getData(CommonDataKeys.EDITOR) ?: return
        val file = e.getData(CommonDataKeys.VIRTUAL_FILE) ?: return
        val service = project.getService(AiosService::class.java)
        
        if (!service.isConnected()) {
            Messages.showErrorDialog(project, "Not connected to AIOS Hub", "AIOS")
            return
        }
        
        val description = Messages.showInputDialog(
            project,
            "Describe what to debate:",
            "Start Council Debate",
            null
        ) ?: return
        
        val selection = editor.selectionModel
        val context = if (selection.hasSelection()) {
            selection.selectedText ?: ""
        } else {
            editor.document.text
        }
        
        val result = service.startDebate(description, file.path, context)
        
        if (result != null) {
            Messages.showInfoMessage(
                project,
                "Decision: ${result.decision}\nConsensus: ${result.consensusLevel}%\n\n${result.reasoning}",
                "Council Debate Result"
            )
        } else {
            Messages.showErrorDialog(project, "Debate failed", "AIOS")
        }
    }
}

class ArchitectModeAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val service = project.getService(AiosService::class.java)
        
        if (!service.isConnected()) {
            Messages.showErrorDialog(project, "Not connected to AIOS Hub", "AIOS")
            return
        }
        
        val task = Messages.showInputDialog(
            project,
            "Describe the task for reasoning:",
            "Architect Mode",
            null
        ) ?: return
        
        val session = service.startArchitectSession(task)
        
        if (session != null) {
            val approve = Messages.showYesNoDialog(
                project,
                "Session: ${session.sessionId}\nStatus: ${session.status}\n\n${session.plan?.description ?: "No plan yet"}\n\nApprove this plan?",
                "Architect Session",
                Messages.getQuestionIcon()
            )
            
            if (approve == Messages.YES) {
                service.approveArchitectPlan(session.sessionId)
                NotificationGroupManager.getInstance()
                    .getNotificationGroup("AIOS Notifications")
                    .createNotification("Plan approved", NotificationType.INFORMATION)
                    .notify(project)
            }
        } else {
            Messages.showErrorDialog(project, "Failed to start architect session", "AIOS")
        }
    }
}

class ViewAnalyticsAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val service = project.getService(AiosService::class.java)
        
        if (!service.isConnected()) {
            Messages.showErrorDialog(project, "Not connected to AIOS Hub", "AIOS")
            return
        }
        
        val summary = service.getAnalyticsSummary()
        
        if (summary != null) {
            Messages.showInfoMessage(
                project,
                """
                Total Supervisors: ${summary.totalSupervisors}
                Total Debates: ${summary.totalDebates}
                Approved: ${summary.totalApproved}
                Rejected: ${summary.totalRejected}
                Avg Consensus: ${summary.avgConsensus?.let { "%.1f%%".format(it) } ?: "N/A"}
                Avg Confidence: ${summary.avgConfidence?.let { "%.2f".format(it) } ?: "N/A"}
                """.trimIndent(),
                "Supervisor Analytics"
            )
        } else {
            Messages.showErrorDialog(project, "Failed to fetch analytics", "AIOS")
        }
    }
}

class RunAgentAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        Messages.showInfoMessage(project, "Run Agent feature coming soon", "AIOS")
    }
}

class SearchMemoryAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        Messages.showInfoMessage(project, "Search Memory feature coming soon", "AIOS")
    }
}
