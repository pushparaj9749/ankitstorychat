package site.beyondredeye.ankitcutz.ui.projects

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Movie
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import site.beyondredeye.ankitcutz.model.ProjectSummary
import site.beyondredeye.ankitcutz.ui.theme.Spacing
import site.beyondredeye.ankitcutz.ui.theme.Tokens

/**
 * Project list. First screen of the app, and the one that must never be confusing:
 * one big "New project", then your work sorted by what you touched last.
 */
@Composable
fun ProjectsScreen(
    projects: List<ProjectSummary>,
    onNew: () -> Unit,
    onOpen: (String) -> Unit,
    onDelete: (String) -> Unit,
) {
    Column(Modifier.fillMaxSize().background(Tokens.bg)) {
        Row(
            Modifier.fillMaxWidth().padding(Spacing.lg.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text("AnkitCutz", color = Tokens.text, fontSize = 28.sp, fontWeight = FontWeight.Bold)
                Text("Phone-first video editor", color = Tokens.textFaint, fontSize = 12.sp)
            }
            Box(
                Modifier
                    .height(40.dp)
                    .background(Tokens.action, RoundedCornerShape(percent = 50))
                    .clickable(onClick = onNew)
                    .padding(horizontal = 16.dp),
                contentAlignment = Alignment.Center,
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.Add, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("New", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        if (projects.isEmpty()) {
            EmptyProjects(onNew)
        } else {
            LazyColumn(
                Modifier.fillMaxSize(),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(
                    start = Spacing.lg.dp,
                    end = Spacing.lg.dp,
                    bottom = Spacing.xxl.dp,
                ),
                verticalArrangement = Arrangement.spacedBy(Spacing.sm.dp),
            ) {
                item {
                    Text(
                        "${projects.size} project${if (projects.size == 1) "" else "s"}",
                        color = Tokens.textFaint,
                        fontSize = 10.sp,
                        letterSpacing = 1.4.sp,
                        modifier = Modifier.padding(bottom = Spacing.xs.dp),
                    )
                }
                items(projects, key = { it.id }) { project ->
                    ProjectCard(project, onClick = { onOpen(project.id) }, onDelete = { onDelete(project.id) })
                }
            }
        }
    }
}

@Composable
private fun ProjectCard(project: ProjectSummary, onClick: () -> Unit, onDelete: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .height(76.dp)
            .background(Tokens.surface, RoundedCornerShape(12.dp))
            .border(1.dp, Tokens.hairline, RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(Spacing.md.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier
                .size(width = 46.dp, height = 54.dp)
                .background(
                    Brush.linearGradient(listOf(Color(0xFF1A1030), Color(0xFF0E1A26))),
                    RoundedCornerShape(8.dp),
                ),
            contentAlignment = Alignment.Center,
        ) {
            Text(project.aspectLabel, color = Tokens.primary, fontSize = 9.sp)
        }
        Spacer(Modifier.width(Spacing.md.dp))
        Column(Modifier.weight(1f)) {
            Text(
                project.name,
                color = Tokens.text,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                buildString {
                    append("${project.clipCount} clip").append(if (project.clipCount == 1) "" else "s")
                    if (project.effectCount > 0) append(" · ${project.effectCount} fx")
                    if (project.durationMs > 0) append(" · ${project.durationMs / 1000}s")
                },
                color = Tokens.textDim,
                fontSize = 11.sp,
            )
            Text(relativeTime(project.updatedAt), color = Tokens.textFaint, fontSize = 10.sp)
        }
        IconButton(onClick = onDelete) {
            Icon(Icons.Filled.Delete, contentDescription = "Delete project", tint = Tokens.textFaint, modifier = Modifier.size(16.dp))
        }
    }
}

@Composable
private fun EmptyProjects(onNew: () -> Unit) {
    Column(
        Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(
            Modifier.size(64.dp).background(Tokens.surface2, RoundedCornerShape(18.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Filled.Movie, contentDescription = null, tint = Tokens.textDim, modifier = Modifier.size(28.dp))
        }
        Spacer(Modifier.height(Spacing.md.dp))
        Text("No projects yet", color = Tokens.text, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
        Text(
            "Import a clip and start cutting — everything stays on this phone.",
            color = Tokens.textFaint,
            fontSize = 11.sp,
            modifier = Modifier.padding(horizontal = 48.dp, vertical = Spacing.xs.dp),
        )
        Spacer(Modifier.height(Spacing.lg.dp))
        Box(
            Modifier
                .height(44.dp)
                .background(Tokens.action, RoundedCornerShape(percent = 50))
                .clickable(onClick = onNew)
                .padding(horizontal = 24.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text("Create project", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
        }
    }
}

private fun relativeTime(updatedAt: Long): String {
    if (updatedAt <= 0L) return "not saved yet"
    val minutes = (System.currentTimeMillis() - updatedAt) / 60_000
    return when {
        minutes < 1 -> "edited just now"
        minutes < 60 -> "edited ${minutes}m ago"
        minutes < 60 * 24 -> "edited ${minutes / 60}h ago"
        else -> "edited ${minutes / (60 * 24)}d ago"
    }
}
