window.EmbedMode = {
  STATIC: 0,
};

window.EmbedsAPI = {
  Static: {
    addAttachment: function(url) {
      var message = JSON.stringify({
        type: EmbedMode.STATIC,
        data: { attachment: url },
      });

      window.postMessage(message, '*');
    },
    replyAttachment: function(url) {
      var message = JSON.stringify({
        type: EmbedMode.STATIC,
        data: { reply: url },
      });

      window.postMessage(message, '*');
    },
    closeWindow: function() {
      var message = JSON.stringify({
        type: EmbedMode.STATIC,
        data: { closeWindow: true },
      });

      window.postMessage(message, '*');
    },
    presentFullscreen: function(url) {
      var message = JSON.stringify({
        type: EmbedMode.STATIC,
        data: { fullscreen: url },
      });

      window.postMessage(message, '*');
    },
  },
}

document.addEventListener('DOMContentLoaded', function() {
  var addAttachments = document.querySelectorAll('[data-plexchat-add-attachment]');
  for (var i = 0; i < addAttachments.length; i += 1) {
    var currentElement = addAttachments[i];
    var currentTarget = currentElement.getAttribute('data-plexchat-add-attachment');
    currentElement.onclick = function(event) {
      event.stopPropagation();
      EmbedsAPI.Static.addAttachment(currentTarget);
    }
  }

  var closeWindows = document.querySelectorAll('[data-plexchat-close-window]');
  for (var i = 0; i < closeWindows.length; i += 1) {
    var currentElement = closeWindows[i];
    currentElement.onclick = function(event) {
      event.stopPropagation();
      EmbedsAPI.Static.closeWindow();
    }
  }

  var fullscreens = document.querySelectorAll('[data-plexchat-present-fullscreen]');
  for (var i = 0; i < fullscreens.length; i += 1) {
    var currentElement = fullscreens[i];
    var currentTarget = currentElement.getAttribute('data-plexchat-present-fullscreen');
    currentElement.onclick = function(event) {
      event.stopPropagation();
      EmbedsAPI.Static.presentFullscreen(currentTarget);
    }
  }
}, false);