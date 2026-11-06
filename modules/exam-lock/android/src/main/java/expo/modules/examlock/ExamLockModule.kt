package expo.modules.examlock

import android.app.ActivityManager
import android.content.Context
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Android screen pinning for exams. While pinned, Home, Recents and the
 * notification shade are blocked, so the student can't switch apps.
 *
 * An ordinary (non device-owner) app can't pin silently: Android shows its own
 * "Pin this app?" confirmation, which the student can decline. The JS side
 * checks [isPinned] and falls back to submitting the exam if they leave.
 */
class ExamLockModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.AppContextLost()

  override fun definition() = ModuleDefinition {
    Name("ExamLock")

    AsyncFunction("pinAsync") {
      val activity = appContext.currentActivity ?: throw Exceptions.MissingActivity()
      activity.startLockTask()
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("unpinAsync") {
      val activity = appContext.currentActivity
      // Not pinned (the user already unpinned) or no activity — nothing to undo.
      if (activity != null && isPinned()) {
        try {
          activity.stopLockTask()
        } catch (e: Exception) {
          // Unpinned between the check and the call.
        }
      }
      Unit
    }.runOnQueue(Queues.MAIN)

    Function("isPinned") { isPinned() }
  }

  private fun isPinned(): Boolean {
    val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
    return am.lockTaskModeState != ActivityManager.LOCK_TASK_MODE_NONE
  }
}
