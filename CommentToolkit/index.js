// index.js

const DEFAULT_ADVENTURE_ID = "";

// Persist control values using localStorage.
const controlIds = ["commentPageId", "pageSize", "filterUsername", "filterUserId", "filterWord", "pageNumber"];
controlIds.forEach(id => {
  const el = document.getElementById(id);
  const savedValue = localStorage.getItem(id);
  if (savedValue !== null) {
    el.value = savedValue;
  }
  el.addEventListener("change", () => localStorage.setItem(id, el.value));
});

// Helper: Calculate relative time from a timestamp.
function getRelativeTime(timestamp) {
  const now = new Date();
  const commentTime = new Date(timestamp);
  const diffMs = now - commentTime;
  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 60) return "just now";
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes !== 1 ? "s" : ""} ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
}

// Helper: Highlight all occurrences (case-insensitive) of word in text.
function highlightWord(text, word) {
  if (!word) return text;
  const regex = new RegExp(`(${word})`, "gi");
  return text.replace(regex, '<span style="color:#f9d548;">$1</span>');
}

// Recursive helper to check if a comment (or any nested reply) contains the filter word.
function commentContainsWord(comment, filterWord) {
  if (comment.message.toLowerCase().includes(filterWord)) {
    return true;
  }
  if (comment.comments && comment.comments.length > 0) {
    return comment.comments.some(reply => commentContainsWord(reply, filterWord));
  }
  return false;
}

// Function to send a reply.
function sendReply(commentId, replyMessage, replyFormContainer) {
  chrome.runtime.sendMessage(
    {
      action: "sendReply",
      commentId: commentId,
      replyMessage: replyMessage
    },
    (response) => {
      if (response && response.success) {
        alert("Reply sent successfully!");
        replyFormContainer.innerHTML = "";
        loadComments();
      } else {
        alert("Failed to send reply: " + (response ? response.error : "No response"));
      }
    }
  );
}

// Function to post a new comment.
function postComment(pageId, commentMessage, formContainer) {
  chrome.runtime.sendMessage(
    {
      action: "postComment",
      relatedToId: pageId,
      commentMessage: commentMessage
    },
    (response) => {
      if (response && response.success) {
        alert("Comment posted successfully!");
        formContainer.style.display = "none";
        formContainer.querySelector("textarea").value = "";
        loadComments();
      } else {
        alert("Failed to post comment: " + (response ? response.error : "No response"));
      }
    }
  );
}

/**
 * Render a single comment (and its nested replies).
 * @param {object} comment - The comment object.
 * @param {boolean} isReply - Whether this is a reply.
 * @param {string} currentViewerId - The stored viewer ID.
 * @param {string} filterWord - The word filter (lowercase) for highlighting.
 * @returns {HTMLElement} The rendered comment element.
 */
function renderComment(comment, isReply = false, currentViewerId, filterWord = "") {
  const container = document.createElement("div");
  container.className = isReply ? "reply-container" : "comment-container";

  const commentEl = document.createElement("div");
  commentEl.className = "comment-box";

  const imgContainer = document.createElement("div");
  imgContainer.className = "comment-pfp";
  const img = document.createElement("img");
  img.src = comment.userProfilePicture;
  img.alt = `${comment.userName}'s profile picture`;
  imgContainer.appendChild(img);

  const detailsDiv = document.createElement("div");
  detailsDiv.className = "comment-details";

  // Username header (clickable to copy viewerProfileId).
  const header = document.createElement("div");
  header.className = "comment-header";
  header.textContent = comment.userName;
  if (currentViewerId && comment.viewerProfileId === currentViewerId) {
    header.style.color = "#f9d548";
  }
  header.style.cursor = "pointer";
  header.title = "Click to copy user ID";
  header.addEventListener("click", () => {
    navigator.clipboard.writeText(comment.viewerProfileId)
      .then(() => alert(`Copied user ID: ${comment.viewerProfileId}`))
      .catch(() => alert("Failed to copy user ID"));
  });

  // Comment message with optional highlighting.
  const message = document.createElement("div");
  message.className = "comment-message";
  if (filterWord) {
    message.innerHTML = highlightWord(comment.message, filterWord);
  } else {
    message.textContent = comment.message;
  }

  const date = document.createElement("div");
  date.className = "comment-date";
  date.textContent = comment.createdDate;

  // Relative time or status.
  const relativeTimeEl = document.createElement("span");
  if (comment.isPending) {
    relativeTimeEl.textContent = " Pending";
    relativeTimeEl.style.color = "#f9d548";
  } else if (comment.status === "Denied") {
    relativeTimeEl.textContent = " Denied";
    relativeTimeEl.style.color = "#ff0000";
  } else {
    relativeTimeEl.textContent = " " + getRelativeTime(comment.createdDateTimestamp);
  }

  const replyButton = document.createElement("button");
  replyButton.textContent = "Reply";
  replyButton.style.marginLeft = "10px";
  replyButton.style.fontSize = "0.8em";

  const replyFormContainer = document.createElement("div");
  replyFormContainer.style.display = "none";
  replyFormContainer.style.marginTop = "5px";

  const replyTextarea = document.createElement("textarea");
  replyTextarea.maxLength = 255;
  replyTextarea.placeholder = "Type your reply (max 255 characters)...";
  replyTextarea.style.width = "100%";
  replyTextarea.style.boxSizing = "border-box";

  const sendReplyButton = document.createElement("button");
  sendReplyButton.textContent = "Send Reply";
  sendReplyButton.style.marginTop = "5px";
  sendReplyButton.style.fontSize = "0.8em";

  const cancelReplyButton = document.createElement("button");
  cancelReplyButton.textContent = "Cancel";
  cancelReplyButton.style.marginTop = "5px";
  cancelReplyButton.style.marginLeft = "5px";
  cancelReplyButton.style.fontSize = "0.8em";

  sendReplyButton.addEventListener("click", () => {
    const replyMessage = replyTextarea.value.trim();
    if (replyMessage) {
      sendReply(comment.id, replyMessage, replyFormContainer);
    } else {
      alert("Reply cannot be empty.");
    }
  });

  cancelReplyButton.addEventListener("click", () => {
    replyFormContainer.style.display = "none";
    replyFormContainer.innerHTML = "";
  });

  function buildReplyForm() {
    replyFormContainer.innerHTML = "";
    replyFormContainer.appendChild(replyTextarea);
    replyFormContainer.appendChild(sendReplyButton);
    replyFormContainer.appendChild(cancelReplyButton);
  }
  buildReplyForm();

  replyButton.addEventListener("click", () => {
    if (replyFormContainer.style.display === "none") {
      buildReplyForm();
      replyFormContainer.style.display = "block";
    } else {
      replyFormContainer.style.display = "none";
    }
  });

  const replyControls = document.createElement("div");
  replyControls.style.display = "flex";
  replyControls.style.alignItems = "center";
  replyControls.style.marginTop = "5px";
  replyControls.appendChild(relativeTimeEl);
  replyControls.appendChild(replyButton);

  detailsDiv.appendChild(header);
  detailsDiv.appendChild(message);
  detailsDiv.appendChild(date);
  detailsDiv.appendChild(replyControls);
  detailsDiv.appendChild(replyFormContainer);

  commentEl.appendChild(imgContainer);
  commentEl.appendChild(detailsDiv);
  container.appendChild(commentEl);

  // Render nested replies.
  if (comment.comments && comment.comments.length > 0) {
    const repliesContainer = document.createElement("div");
    repliesContainer.className = "replies";
    comment.comments.forEach(reply => {
      const replyEl = renderComment(reply, true, currentViewerId, filterWord);
      repliesContainer.appendChild(replyEl);
    });
    container.appendChild(repliesContainer);
  }
  return container;
}

/**
 * Render an array of comments. If a filter word is provided, include a comment
 * if its message or any of its replies contains the word.
 * @param {Array} comments - Array of comment objects.
 * @param {string} currentViewerId - The current viewer ID.
 * @param {string} filterWord - The word filter (lowercase).
 */
function renderCommentsWrapper(comments, currentViewerId, filterWord) {
  // If filtering by word, include a comment if it or any nested reply contains the word.
  const filtered = filterWord
    ? comments.filter(c => c.message.toLowerCase().includes(filterWord) || (c.comments && c.comments.some(r => commentContainsWord(r, filterWord))))
    : comments;
  const container = document.getElementById("comments-container");
  container.innerHTML = "";
  filtered.forEach(comment => {
    const commentEl = renderComment(comment, false, currentViewerId, filterWord);
    container.appendChild(commentEl);
  });
}

// Show loading indicator.
function showLoading() {
  document.getElementById("loadingIndicator").style.display = "block";
}
// Hide loading indicator.
function hideLoading() {
  document.getElementById("loadingIndicator").style.display = "none";
}

// Fetch comments using current control values.
function loadComments() {
  showLoading();
  const commentPageId = document.getElementById("commentPageId").value.trim() || DEFAULT_ADVENTURE_ID;
  const pageNumberInput = document.getElementById("pageNumber").value.trim();
  const pageNumber = pageNumberInput ? parseInt(pageNumberInput, 10) : 1;
  const pageSizeInput = document.getElementById("pageSize").value.trim();
  const pageSize = pageSizeInput ? parseInt(pageSizeInput, 10) : 10;
  const filterUsername = document.getElementById("filterUsername").value.trim().toLowerCase();
  const filterUserId = document.getElementById("filterUserId").value.trim();
  const filterWord = document.getElementById("filterWord").value.trim().toLowerCase();

  chrome.runtime.sendMessage(
    {
      action: "fetchComments",
      relatedToId: commentPageId,
      pageNumber: pageNumber,
      pageSize: pageSize
    },
    (response) => {
      hideLoading();
      if (response && response.success) {
        let comments = response.data.comments || [];
        // Filter by username.
        if (filterUsername) {
          comments = comments.filter(c => c.userName.toLowerCase().includes(filterUsername));
        }
        // Filter by user ID.
        if (filterUserId) {
          comments = comments.filter(c => c.viewerProfileId === filterUserId);
        }
        // For word filtering, we use our recursive helper.
        chrome.storage.local.get("viewerId", (result) => {
          const currentViewerId = result.viewerId;
          renderCommentsWrapper(comments, currentViewerId, filterWord);
        });
      } else {
        console.error("Failed to fetch comments:", response ? response.error : "No response");
      }
    }
  );
}

document.getElementById("fetchButton").addEventListener("click", loadComments);

// New Comment form controls.
const commentButton = document.getElementById("commentButton");
const newCommentForm = document.getElementById("newCommentForm");
const postCommentButton = document.getElementById("postCommentButton");
const cancelCommentButton = document.getElementById("cancelCommentButton");

commentButton.addEventListener("click", () => {
  // Toggle the new comment form visibility.
  newCommentForm.style.display = newCommentForm.style.display === "none" ? "block" : "none";
});

postCommentButton.addEventListener("click", () => {
  const commentMessage = document.getElementById("newCommentText").value.trim();
  if (!commentMessage) {
    alert("Comment cannot be empty.");
    return;
  }
  const commentPageId = document.getElementById("commentPageId").value.trim() || DEFAULT_ADVENTURE_ID;
  // Post the comment.
  chrome.runtime.sendMessage(
    {
      action: "postComment",
      relatedToId: commentPageId,
      commentMessage: commentMessage
    },
    (response) => {
      if (response && response.success) {
        alert("Comment posted successfully!");
        newCommentForm.style.display = "none";
        document.getElementById("newCommentText").value = "";
        loadComments();
      } else {
        alert("Failed to post comment: " + (response ? response.error : "No response"));
      }
    }
  );
});

cancelCommentButton.addEventListener("click", () => {
  newCommentForm.style.display = "none";
  document.getElementById("newCommentText").value = "";
});
