/* ============================================
   Heart & Health Tracker — Notifications
   PWA push notifications + in-app fallbacks
   ============================================ */

const Notifications = {
  _permission: 'default',

  async init() {
    if ('Notification' in window) {
      this._permission = Notification.permission;
    }
  },

  async requestPermission() {
    if (!('Notification' in window)) {
      UI.showToast('Notifications not supported on this device', 'info');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      this._permission = result;

      if (result === 'granted') {
        UI.showToast('Notifications enabled!', 'success');
        await this.scheduleMedReminders();
        return true;
      } else {
        UI.showToast('Notifications denied. In-app reminders will still work.', 'info');
        return false;
      }
    } catch (e) {
      UI.showToast('Could not request notification permission', 'error');
      return false;
    }
  },

  async scheduleMedReminders() {
    // For PWA on iOS, we can't reliably schedule future notifications
    // without a push server. We rely on in-app popups (checkMedicationReminders)
    // and try to show notifications when the app is open.
    console.log('Medication reminders active (in-app fallback mode)');
  },

  show(title, body) {
    if (this._permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: 'img/icon-192.png',
          badge: 'img/icon-192.png'
        });
      } catch (e) {
        // Fallback: just show toast
        UI.showToast(`${title}: ${body}`, 'info');
      }
    } else {
      UI.showToast(`${title}: ${body}`, 'info');
    }
  }
};
