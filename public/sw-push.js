self.addEventListener('push', function (event) {
  if (!event.data) {
    console.log('This push event has no data.');
    return;
  }

  try {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: data.icon || '/logo-192.png',
      badge: data.badge || '/logo-96.png', // A smaller icon for some UIs
      data: {
        url: data.data?.url // The URL to open on click
      }
    };
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  } catch (e) {
    console.error('Push event data is not valid JSON:', event.data.text(), e);
    // Fallback for plain text push
    const options = {
      body: event.data.text(),
      icon: '/logo-192.png',
      badge: '/logo-96.png',
    };
    event.waitUntil(
      self.registration.showNotification('Nytt varsel', options)
    );
  }
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close(); // Close the notification

  const urlToOpen = event.notification.data?.url;

  if (urlToOpen) {
    // This looks for an existing window/tab with the same path and focuses it.
    event.waitUntil(
      clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      }).then(function (windowClients) {
        const fullUrlToOpen = new URL(urlToOpen, self.location.origin).href;

        // Check if there is already a window/tab open with the target URL
        for (var i = 0; i < windowClients.length; i++) {
          var client = windowClients[i];
          if (client.url === fullUrlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        
        // If not, open a new window/tab.
        if (clients.openWindow) {
          return clients.openWindow(fullUrlToOpen);
        }
      })
    );
  }
});
