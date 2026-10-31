package expo.modules.kanakkucapture

import android.Manifest
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

internal class SmsPermissionException :
  CodedException("ERR_SMS_PERMISSION", "SMS permission is not granted", null)

class KanakkuCaptureModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context is not available" }

  override fun definition() = ModuleDefinition {
    Name("KanakkuCapture")

    Events("onPaymentNotification")

    OnCreate {
      PaymentNotificationService.listener = { item ->
        try {
          this@KanakkuCaptureModule.sendEvent("onPaymentNotification", mapOf("item" to item))
        } catch (e: Throwable) {
        }
      }
    }

    OnDestroy {
      PaymentNotificationService.listener = null
    }

    Function("hasSmsPermission") {
      ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED
    }

    /**
     * Inbox SMS newer than [sinceMillis], newest first, at most [limit].
     * Only messages from alphanumeric senders (bank / DLT headers like "VM-HDFCBK-S") are returned —
     * personal chats from phone numbers are skipped here and never reach JS.
     */
    AsyncFunction("readSms") { sinceMillis: Double, limit: Int ->
      if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
        throw SmsPermissionException()
      }
      val out = ArrayList<Map<String, Any>>()
      val cursor = context.contentResolver.query(
        Uri.parse("content://sms/inbox"),
        arrayOf("_id", "address", "body", "date"),
        "date > ?",
        arrayOf(sinceMillis.toLong().toString()),
        "date DESC",
      )
      cursor?.use { c ->
        val idIdx = c.getColumnIndex("_id")
        val addrIdx = c.getColumnIndex("address")
        val bodyIdx = c.getColumnIndex("body")
        val dateIdx = c.getColumnIndex("date")
        while (c.moveToNext() && out.size < limit) {
          val address = if (addrIdx >= 0) c.getString(addrIdx).orEmpty() else ""
          if (!address.any { it.isLetter() }) continue
          val body = if (bodyIdx >= 0) c.getString(bodyIdx).orEmpty() else ""
          if (!body.any { it.isDigit() }) continue
          out.add(
            mapOf(
              "id" to "sms:" + (if (idIdx >= 0) c.getLong(idIdx).toString() else ""),
              "source" to "sms",
              "sender" to address,
              "body" to body,
              "timestamp" to (if (dateIdx >= 0) c.getLong(dateIdx).toDouble() else 0.0),
            ),
          )
        }
      }
      out
    }

    Function("isNotificationAccessGranted") {
      NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName)
    }

    Function("openNotificationAccessSettings") {
      val component = ComponentName(context, PaymentNotificationService::class.java).flattenToString()
      val intents = listOf(
        Intent("android.settings.NOTIFICATION_LISTENER_DETAIL_SETTINGS")
          .putExtra("android.provider.extra.NOTIFICATION_LISTENER_COMPONENT_NAME", component),
        Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS),
      )
      for (intent in intents) {
        try {
          intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          context.startActivity(intent)
          return@Function true
        } catch (e: Throwable) {
        }
      }
      false
    }

    Function("pendingNotificationCount") {
      PendingStore.count(context)
    }

    Function("drainNotifications") {
      PendingStore.drain(context)
    }
  }
}
