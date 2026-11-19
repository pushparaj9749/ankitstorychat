plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

android {
    namespace = "site.beyondredeye.ankitcutz"
    compileSdk = 35

    defaultConfig {
        applicationId = "site.beyondredeye.ankitcutz"
        minSdk = 26
        // targetSdk 36 (Android 16) is required by Play from Aug 2026; bump together
        // with compileSdk once AGP supports API 36 on CI. Not a launch blocker now.
        targetSdk = 35
        versionCode = 2
        versionName = "0.2.0"
    }

    buildTypes {
        release {
            // R8 off for 0.2: Compose + kotlinx.serialization keep rules have not been
            // exercised on a device yet, and a silently stripped serializer is a crash.
            // Flipping this on is a Phase-2 task with an instrumented smoke test.
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            // Signed with AGP's debug key so any build is installable without secrets.
            // Play upload needs a real key (PLAN.md §8) — that is a deliberate later step.
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
    }

    packaging {
        resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons.extended)
    implementation(libs.androidx.lifecycle.runtime.compose)

    // Playback, presentation and trim export. Apache-2.0 throughout (PLAN.md §6.8).
    implementation(libs.media3.exoplayer)
    implementation(libs.media3.ui)
    implementation(libs.media3.transformer)

    implementation(libs.kotlinx.serialization.json)
    debugImplementation(libs.androidx.compose.ui.tooling)
    testImplementation(libs.junit)
}
