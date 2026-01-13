package com.aios.plugin

import com.intellij.openapi.components.Service
import com.intellij.openapi.project.Project
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import com.google.gson.Gson
import com.google.gson.JsonObject
import java.io.IOException

@Service(Service.Level.PROJECT)
class AiosService(private val project: Project) {
    
    private val client = OkHttpClient()
    private val gson = Gson()
    private var hubUrl = "http://localhost:3000"
    private var connected = false
    
    fun setHubUrl(url: String) {
        hubUrl = url.trimEnd('/')
    }
    
    fun isConnected(): Boolean = connected
    
    fun connect(): Boolean {
        return try {
            val request = Request.Builder()
                .url("$hubUrl/api/health")
                .get()
                .build()
            
            client.newCall(request).execute().use { response ->
                connected = response.isSuccessful
                connected
            }
        } catch (e: IOException) {
            connected = false
            false
        }
    }
    
    fun disconnect() {
        connected = false
    }
    
    fun startDebate(description: String, filePath: String, context: String): DebateResult? {
        val task = JsonObject().apply {
            addProperty("id", "jetbrains-${System.currentTimeMillis()}")
            addProperty("description", description)
            add("files", gson.toJsonTree(listOf(filePath)))
            addProperty("context", context.take(10000))
        }
        
        val body = JsonObject().apply {
            add("task", task)
        }
        
        val request = Request.Builder()
            .url("$hubUrl/api/council/debate")
            .post(gson.toJson(body).toRequestBody("application/json".toMediaType()))
            .build()
        
        return try {
            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    gson.fromJson(response.body?.string(), DebateResult::class.java)
                } else null
            }
        } catch (e: IOException) {
            null
        }
    }
    
    fun startArchitectSession(task: String): ArchitectSession? {
        val body = JsonObject().apply {
            addProperty("task", task)
        }
        
        val request = Request.Builder()
            .url("$hubUrl/api/architect/sessions")
            .post(gson.toJson(body).toRequestBody("application/json".toMediaType()))
            .build()
        
        return try {
            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    gson.fromJson(response.body?.string(), ArchitectSession::class.java)
                } else null
            }
        } catch (e: IOException) {
            null
        }
    }
    
    fun approveArchitectPlan(sessionId: String): Boolean {
        val request = Request.Builder()
            .url("$hubUrl/api/architect/sessions/$sessionId/approve")
            .post("".toRequestBody())
            .build()
        
        return try {
            client.newCall(request).execute().use { it.isSuccessful }
        } catch (e: IOException) {
            false
        }
    }
    
    fun getAnalyticsSummary(): AnalyticsSummary? {
        val request = Request.Builder()
            .url("$hubUrl/api/supervisor-analytics/summary")
            .get()
            .build()
        
        return try {
            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    val json = gson.fromJson(response.body?.string(), JsonObject::class.java)
                    gson.fromJson(json.get("summary"), AnalyticsSummary::class.java)
                } else null
            }
        } catch (e: IOException) {
            null
        }
    }
    
    fun getDebateTemplates(): List<DebateTemplate> {
        val request = Request.Builder()
            .url("$hubUrl/api/debate-templates")
            .get()
            .build()
        
        return try {
            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    val json = gson.fromJson(response.body?.string(), JsonObject::class.java)
                    gson.fromJson(json.getAsJsonArray("templates"), Array<DebateTemplate>::class.java).toList()
                } else emptyList()
            }
        } catch (e: IOException) {
            emptyList()
        }
    }
}

data class DebateResult(
    val decision: String,
    val consensusLevel: Double,
    val reasoning: String,
    val votes: List<Vote>
)

data class Vote(
    val supervisor: String,
    val vote: String,
    val confidence: Double,
    val reasoning: String
)

data class ArchitectSession(
    val sessionId: String,
    val status: String,
    val reasoningOutput: String?,
    val plan: EditPlan?
)

data class EditPlan(
    val description: String,
    val complexity: String,
    val files: List<String>,
    val steps: List<String>
)

data class AnalyticsSummary(
    val totalSupervisors: Int,
    val totalDebates: Int,
    val totalApproved: Int,
    val totalRejected: Int,
    val avgConsensus: Double?,
    val avgConfidence: Double?
)

data class DebateTemplate(
    val id: String,
    val name: String,
    val description: String?
)
