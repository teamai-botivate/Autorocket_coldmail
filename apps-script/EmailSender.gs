/**
 * EmailSender.gs
 * ------------------------------------------------------------------------
 * Sends a single EMAIL_QUEUE row via GmailApp / MailApp and returns the
 * resulting Gmail message ID + thread ID for storage.
 *
 * WHY GmailApp.sendEmail() + a follow-up search, instead of raw MIME:
 * GmailApp does not let you set arbitrary custom headers (e.g. a custom
 * X-Botivate-Lead-Id header) on outgoing mail, and does not return a
 * message/thread ID directly from sendEmail(). To reliably recover the
 * message we just sent, we:
 *   1. Send with GmailApp.sendEmail(...), passing a distinguishing
 *      Subject (already unique-ish per lead/template) and body.
 *   2. Immediately search Gmail (GmailApp.search) restricted to
 *      "in:sent to:<recipient> subject:<subject>" and take the most
 *      recent matching thread/message as ours.
 * This is a best-effort fallback matching strategy - it is reliable in
 * practice because sends are processed one at a time (serialized by
 * LockService in QueueWorker), so there is no concurrent send to the same
 * recipient+subject at the same moment from this script.
 *
 * ADVANCED GMAIL SERVICE (optional, recommended for production):
 * If you enable the advanced Gmail Service (Apps Script editor > Services
 * > + > Gmail API), you can use Gmail.Users.Messages.send() instead, which
 * returns the message id and thread id directly in the response, removing
 * the need for the search-based fallback. This file keeps the
 * GmailApp-based approach as the default because it requires zero extra
 * setup, but ReplyScanner.gs documents how to use the advanced service
 * for header-level reply matching, and the same technique can be applied
 * here if you want tighter guarantees.
 *
 * TEST MODE (System.txt #82): when EMAIL_TEST_MODE is true, the actual
 * Gmail recipient is redirected to TEST_EMAIL, but the row's own
 * recipient_email column (the real intended recipient) is left untouched
 * by this function - QueueWorker is responsible for keeping that value
 * intact in EMAIL_QUEUE and recording it in EMAIL_EVENTS metadata so nothing
 * is lost. This function also sets/reads the EMAIL_QUEUE `test_mode`
 * boolean column that already exists in the schema (never invent a new
 * column for this).
 */

/**
 * Sends an email for the given EMAIL_QUEUE row.
 *
 * @param {Object} queueRow A row object from EMAIL_QUEUE (as returned by
 *   SheetRepository.getRows/findRowById), i.e. it has recipient_email,
 *   sender_email, subject, body, html_body, queue_id, etc.
 * @return {{success: boolean, messageId: string, threadId: string,
 *   actualRecipient: string, error: string}} Result descriptor. On
 *   failure, `error` contains a message and success is false; caller
 *   (QueueWorker) decides retry vs. fail based on this.
 */
function sendQueuedEmail(queueRow) {
  var intendedRecipient = String(queueRow.recipient_email || '').trim();
  var testMode = BotivateConfig.EMAIL_TEST_MODE();
  var actualRecipient = intendedRecipient;

  if (!isValidEmail(intendedRecipient) && !testMode) {
    return { success: false, messageId: '', threadId: '', actualRecipient: '', error: 'Invalid recipient email: "' + intendedRecipient + '"' };
  }

  if (testMode) {
    var testEmail = BotivateConfig.TEST_EMAIL();
    if (!testEmail || !isValidEmail(testEmail)) {
      return { success: false, messageId: '', threadId: '', actualRecipient: '', error: 'EMAIL_TEST_MODE is on but TEST_EMAIL is missing/invalid.' };
    }
    actualRecipient = testEmail;
  }

  var senderName = BotivateConfig.BOTIVATE_SENDER_NAME();
  var subject = String(queueRow.subject || '(no subject)');
  // In test mode, prefix the subject so it's obvious in the inbox that
  // this was a redirected send, and include the real intended recipient
  // in the body so nothing is lost even if metadata is not consulted.
  var effectiveSubject = subject;
  var plainBody = String(queueRow.body || '');
  var htmlBody = queueRow.html_body ? String(queueRow.html_body) : undefined;

  if (testMode) {
    effectiveSubject = '[TEST MODE - would send to ' + intendedRecipient + '] ' + subject;
    var testNotice = '\n\n---\n[Botivate TEST MODE] This email would have been sent to: ' + intendedRecipient + '\n';
    plainBody = plainBody + testNotice;
    if (htmlBody) {
      htmlBody = htmlBody + '<hr><p style="color:#999;font-size:12px;">[Botivate TEST MODE] This email would have been sent to: ' +
        Utilities.htmlEncode(intendedRecipient) + '</p>';
    }
  }

  var options = { name: senderName || 'Botivate Services LLP' };
  if (htmlBody) options.htmlBody = htmlBody;

  try {
    GmailApp.sendEmail(actualRecipient, effectiveSubject, plainBody, options);
  } catch (sendErr) {
    return { success: false, messageId: '', threadId: '', actualRecipient: actualRecipient, error: 'GmailApp.sendEmail failed: ' + sendErr.message };
  }

  // Immediately look up the just-sent message to capture its message id /
  // thread id. We search "in:sent" scoped to the recipient + exact
  // subject, and take the most recent thread (sends are serialized under
  // LockService by QueueWorker, so this is safe in practice).
  var lookup = { messageId: '', threadId: '' };
  try {
    lookup = findJustSentMessage_(actualRecipient, effectiveSubject);
  } catch (lookupErr) {
    // Non-fatal: the email was sent successfully; we just couldn't
    // recover its IDs. Log and continue - QueueWorker will still mark
    // this SENT, just with blank message_id/thread_id.
    Logger.log('Warning: sent email but failed to look up message/thread id: ' + lookupErr.message);
  }

  // Apply the SENT_LABEL to the resulting thread so ReplyScanner can find
  // it later. Do this even if lookup partially failed but we have a thread.
  if (lookup.threadId) {
    try {
      applySentLabelToThread_(lookup.threadId);
    } catch (labelErr) {
      Logger.log('Warning: failed to apply SENT label to thread ' + lookup.threadId + ': ' + labelErr.message);
    }
  }

  return {
    success: true,
    messageId: lookup.messageId || '',
    threadId: lookup.threadId || '',
    actualRecipient: actualRecipient,
    error: ''
  };
}

/**
 * Searches Gmail's Sent folder for the message we just sent, matching by
 * recipient + exact subject, and returns the most recent match.
 * @private
 */
function findJustSentMessage_(recipient, subject) {
  // Gmail search operators: escape double quotes in subject to keep the
  // query well-formed.
  var safeSubject = subject.replace(/"/g, '\\"');
  var query = 'in:sent to:(' + recipient + ') subject:"' + safeSubject + '"';
  var threads = GmailApp.search(query, 0, 5);
  if (threads.length === 0) {
    return { messageId: '', threadId: '' };
  }
  // Most recent thread first (GmailApp.search returns newest-first by default).
  var thread = threads[0];
  var messages = thread.getMessages();
  var lastMessage = messages[messages.length - 1];
  return {
    messageId: lastMessage.getId(),
    threadId: thread.getId()
  };
}

/**
 * Applies the configured SENT_LABEL to a thread, creating the label if it
 * does not already exist.
 * @private
 */
function applySentLabelToThread_(threadId) {
  var labelName = BotivateConfig.SENT_LABEL();
  if (!labelName) return;
  var label = GmailApp.getUserLabelByName(labelName);
  if (!label) {
    label = GmailApp.createLabel(labelName);
  }
  var thread = GmailApp.getThreadById(threadId);
  if (thread) {
    thread.addLabel(label);
  }
}
