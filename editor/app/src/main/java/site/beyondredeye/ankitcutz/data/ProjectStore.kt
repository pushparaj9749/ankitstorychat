package site.beyondredeye.ankitcutz.data

import kotlinx.serialization.json.Json
import site.beyondredeye.ankitcutz.model.Project
import site.beyondredeye.ankitcutz.model.ProjectSummary
import java.io.File

/**
 * Project persistence: one JSON file per project, written atomically.
 *
 * Plain `java.io` on purpose — no Room, no DataStore, no Android types — so the round
 * trip is covered by JVM unit tests and a corrupted save can be read in a text editor.
 * `ignoreUnknownKeys` means a newer build can add fields without breaking old files.
 */
object ProjectCodec {
    val json: Json = Json {
        prettyPrint = true
        encodeDefaults = true
        ignoreUnknownKeys = true
    }

    fun encode(project: Project): String = json.encodeToString(Project.serializer(), project)

    fun decode(text: String): Project = json.decodeFromString(Project.serializer(), text)
}

class ProjectStore(private val dir: File) {

    init {
        if (!dir.exists()) dir.mkdirs()
    }

    fun fileFor(id: String): File = File(dir, "$id.json")

    /** Returns the project with `updatedAt` stamped, which is what callers keep in memory. */
    fun save(project: Project): Project {
        val stamped = project.touch()
        val target = fileFor(stamped.id)
        val temp = File(dir, "${stamped.id}.json.tmp")
        temp.writeText(ProjectCodec.encode(stamped))
        // Rename is atomic on the same filesystem: a kill mid-save cannot truncate a project.
        if (target.exists() && !target.delete()) {
            target.writeText(ProjectCodec.encode(stamped))
            temp.delete()
            return stamped
        }
        if (!temp.renameTo(target)) {
            target.writeText(ProjectCodec.encode(stamped))
            temp.delete()
        }
        return stamped
    }

    fun load(id: String): Project? {
        val file = fileFor(id)
        if (!file.exists()) return null
        return runCatching { ProjectCodec.decode(file.readText()) }.getOrNull()
    }

    fun delete(id: String): Boolean = fileFor(id).delete()

    fun all(): List<Project> = dir.listFiles { file -> file.name.endsWith(".json") }
        .orEmpty()
        .mapNotNull { file -> runCatching { ProjectCodec.decode(file.readText()) }.getOrNull() }
        .sortedByDescending { it.updatedAt }

    fun summaries(): List<ProjectSummary> = all().map { project ->
        ProjectSummary(
            id = project.id,
            name = project.name,
            aspectLabel = project.aspectLabel,
            clipCount = project.clipCount,
            effectCount = project.effectCount,
            durationMs = project.totalDurationMs,
            updatedAt = project.updatedAt,
        )
    }

    /** Duplicating is how people try a different cut without risking the original. */
    fun duplicate(project: Project, nameSuffix: String = " copy"): Project {
        val copy = project.copy(id = site.beyondredeye.ankitcutz.model.randomId(), name = project.name + nameSuffix, updatedAt = 0L)
        return save(copy)
    }
}
