package expo.modules.kanakkucapture

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * Payment notifications caught while the app was closed wait here (app-private storage)
 * until the JS side drains them. Capped so it can never grow without bound.
 */
internal object PendingStore {
  private const val PREFS = "kanakku_capture"
  private const val KEY = "pending_notifications"
  private const val MAX_ITEMS = 300

  private val lock = Any()

  fun add(context: Context, item: JSONObject) {
    synchronized(lock) {
      val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      val current = JSONArray(prefs.getString(KEY, "[]") ?: "[]")
      val id = item.optString("id")
      for (i in 0 until current.length()) {
        if (current.optJSONObject(i)?.optString("id") == id) return
      }
      current.put(item)
      val trimmed = JSONArray()
      val start = (current.length() - MAX_ITEMS).coerceAtLeast(0)
      for (i in start until current.length()) trimmed.put(current.get(i))
      prefs.edit().putString(KEY, trimmed.toString()).apply()
    }
  }

  fun count(context: Context): Int = synchronized(lock) {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    JSONArray(prefs.getString(KEY, "[]") ?: "[]").length()
  }

  /** Returns everything that is waiting and clears the store. */
  fun drain(context: Context): List<Map<String, Any>> = synchronized(lock) {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val current = JSONArray(prefs.getString(KEY, "[]") ?: "[]")
    prefs.edit().putString(KEY, "[]").apply()
    (0 until current.length()).mapNotNull { i -> current.optJSONObject(i)?.let { toMap(it) } }
  }

  fun toMap(o: JSONObject): Map<String, Any> = mapOf(
    "id" to o.optString("id"),
    "source" to "notification",
    "sender" to o.optString("sender"),
    "title" to o.optString("title"),
    "body" to o.optString("body"),
    "timestamp" to o.optDouble("timestamp", 0.0),
  )
}
