package expo.modules.kanakkucapture

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONObject

/**
 * Android calls this for every notification once the user grants "Notification access".
 * We keep only notifications from UPI / wallet apps that mention a rupee amount — everything
 * else is dropped immediately and never stored.
 */
class PaymentNotificationService : NotificationListenerService() {

  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    if (sbn == null) return
    try {
      if (sbn.packageName !in PAYMENT_PACKAGES) return
      val n = sbn.notification ?: return
      if ((n.flags and Notification.FLAG_GROUP_SUMMARY) != 0) return
      if ((n.flags and Notification.FLAG_ONGOING_EVENT) != 0) return

      val extras = n.extras ?: return
      val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
      val body = (extras.getCharSequence(Notification.EXTRA_BIG_TEXT) ?: extras.getCharSequence(Notification.EXTRA_TEXT))
        ?.toString().orEmpty()
      val text = "$title $body"
      if (!AMOUNT_HINT.containsMatchIn(text)) return

      val id = "${sbn.packageName}|${(title + "|" + body).hashCode()}|${sbn.postTime / 60000}"
      val item = JSONObject()
        .put("id", id)
        .put("sender", sbn.packageName)
        .put("title", title)
        .put("body", body)
        .put("timestamp", sbn.postTime.toDouble())

      PendingStore.add(applicationContext, item)
      listener?.invoke(PendingStore.toMap(item))
    } catch (e: Throwable) {
      // Never crash the system listener because of one odd notification.
    }
  }

  companion object {
    /** Set by the JS module while the app is running so new payments show up live. */
    @Volatile
    var listener: ((Map<String, Any>) -> Unit)? = null

    val PAYMENT_PACKAGES = setOf(
      "com.google.android.apps.nbu.paisa.user", // Google Pay
      "com.phonepe.app", // PhonePe
      "net.one97.paytm", // Paytm
      "in.org.npci.upiapp", // BHIM
      "in.amazon.mShop.android.shopping", // Amazon Pay
      "com.dreamplug.androidapp", // CRED
      "com.mobikwik_new", // MobiKwik
      "com.myairtelapp", // Airtel Thanks / Payments Bank
      "money.super.payments", // super.money
      "com.naviapp", // Navi UPI
    )

    private val AMOUNT_HINT = Regex("₹|\\b(?:rs|inr)\\.?\\s*\\d", RegexOption.IGNORE_CASE)
  }
}
