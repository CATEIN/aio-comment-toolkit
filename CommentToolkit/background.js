// background.js

// Capture and store headers from matching requests.
chrome.webRequest.onBeforeSendHeaders.addListener(
    (details) => {
      const updates = {};
  
      // Capture the Authorization header (the token)
      const authHeader = details.requestHeaders.find(header =>
        header.name.toLowerCase() === "authorization"
      );
      if (authHeader) {
        updates.apiToken = authHeader.value;
      }
  
      // Capture the x-viewer-id header
      const viewerHeader = details.requestHeaders.find(header =>
        header.name.toLowerCase() === "x-viewer-id"
      );
      if (viewerHeader) {
        updates.viewerId = viewerHeader.value;
      }
  
      // Capture the x-pin header; if not found, set it to an empty string.
      const viewerPin = details.requestHeaders.find(header =>
        header.name.toLowerCase() === "x-pin"
      );
      if (viewerPin) {
        updates.xPin = viewerPin.value;
      } else {
        updates.xPin = "";
      }
  
      if (Object.keys(updates).length > 0) {
        console.log("Updating stored credentials:", updates);
        chrome.storage.local.set(updates);
      }
    },
    { urls: ["https://app.adventuresinodyssey.com/*", "https://fotf.my.site.com/*"] },
    ["requestHeaders"]
  );
  
  // Open a new tab when the extension icon is clicked.
  chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({ url: 'index.html' });
  });
  
  // Function to fetch comments using POST.
  async function fetchComments(relatedToId, pageNumber = 1, pageSize = 20) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(["apiToken", "viewerId", "xPin"], async (result) => {
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError);
        }
  
        if (!result.apiToken) {
          return reject(new Error("No API token found in storage."));
        }
  
        const commentSearchUrl = "https://fotf.my.site.com/aio/services/apexrest/v1/comment/search";
        const payload = {
          orderBy: "CreatedDate DESC",
          pageNumber: pageNumber,
          pageSize: pageSize,
          relatedToId: relatedToId
        };
  
        // Build headers using the stored credentials.
        const headers = {
          "Authorization": result.apiToken,
          "Content-Type": "application/json",
          'x-experience-name': "Adventures In Odyssey"
        };
  
        if (result.viewerId) {
          headers["x-viewer-id"] = result.viewerId;
        }
        if (result.xPin !== undefined) {
          headers["x-pin"] = result.xPin;
        }
  
        try {
          const response = await fetch(commentSearchUrl, {
            method: "POST",
            headers: headers,
            body: JSON.stringify(payload)
          });
  
          if (!response.ok) {
            throw new Error("Error fetching comments: " + response.statusText);
          }
  
          const data = await response.json();
          resolve(data);
        } catch (error) {
          reject(error);
        }
      });
    });
  }
  
  // Listen for messages from the extension page.
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "fetchComments") {
      fetchComments(request.relatedToId, request.pageNumber, request.pageSize)
        .then(data => sendResponse({ success: true, data }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    }
  });
  
  
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "sendReply") {
      chrome.storage.local.get(["apiToken", "viewerId", "xPin"], async (result) => {
        if (chrome.runtime.lastError || !result.apiToken) {
          sendResponse({ success: false, error: "No API token found in storage." });
          return;
        }
  
        // Build the payload for the reply.
        const payload = {
          comment: {
            relatedToId: request.commentId,
            viewerProfileId: result.viewerId,
            message: request.replyMessage
          },
          message: request.replyMessage,
          relatedToId: request.commentId,
          viewerProfileId: result.viewerId
        };
  
        try {
          const response = await fetch("https://fotf.my.site.com/aio/services/apexrest/v1/comment", {
            method: "POST",
            headers: {
              "Authorization": result.apiToken,
              "x-viewer-id": result.viewerId,
              "Content-Type": "application/json",
              "x-experience-name": "Adventures In Odyssey"
            },
            body: JSON.stringify(payload)
          });
  
          // Consider 201 (Created) as success.
          if (response.status === 201 || response.ok) {
            const data = await response.json();
            sendResponse({ success: true, data });
          } else {
            throw new Error("Error sending reply: " + response.statusText);
          }
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      });
      return true;
    }
  });

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "postComment") {
      chrome.storage.local.get(["apiToken", "viewerId", "xPin"], async (result) => {
        if (chrome.runtime.lastError || !result.apiToken) {
          sendResponse({ success: false, error: "No API token found in storage." });
          return;
        }
        // Build payload using relatedToId from request (i.e. the page id)
        const payload = {
          comment: {
            relatedToId: request.relatedToId,
            viewerProfileId: result.viewerId,
            message: request.commentMessage
          },
          message: request.commentMessage,
          relatedToId: request.relatedToId,
          viewerProfileId: result.viewerId
        };
        try {
          const response = await fetch("https://fotf.my.site.com/aio/services/apexrest/v1/comment", {
            method: "POST",
            headers: {
              "Authorization": result.apiToken,
              "x-viewer-id": result.viewerId,
              "Content-Type": "application/json",
              "x-experience-name": "Adventures In Odyssey"
            },
            body: JSON.stringify(payload)
          });
          if (response.status === 201 || response.ok) {
            const data = await response.json();
            sendResponse({ success: true, data });
          } else {
            throw new Error("Error posting comment: " + response.statusText);
          }
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      });
      return true;
    }
  });