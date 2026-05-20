# ── Flutter core ──────────────────────────────────────────────────────────────
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }
-dontwarn io.flutter.embedding.**

# ── Play Core (Flutter deferred components — keep to avoid R8 missing class) ──
-dontwarn com.google.android.play.core.**
-keep class com.google.android.play.core.** { *; }

# ── flutter_secure_storage ────────────────────────────────────────────────────
-keep class com.it_nomads.fluttersecurestorage.** { *; }

# ── Dio / OkHttp ──────────────────────────────────────────────────────────────
-dontwarn okhttp3.**
-keep class okhttp3.** { *; }
-keepattributes Signature
-keepattributes *Annotation*

# ── App classes ───────────────────────────────────────────────────────────────
-keep class com.icdv.tpfcs_mobile.** { *; }
