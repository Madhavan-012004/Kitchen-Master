package com.probloom.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.logging.Logger;

@Service
public class EmailService {

    private static final Logger logger = Logger.getLogger(EmailService.class.getName());

    @Autowired(required = false)
    private JavaMailSender javaMailSender;

    @Value("${spring.mail.username:}")
    private String fromEmail;

    @Async
    public void sendEmailWithAttachment(String to, String subject, String body, String attachmentFilename, byte[] attachmentData) {
        String fEmail = this.fromEmail;
        if (javaMailSender == null || fEmail == null || fEmail.isEmpty()) {
            logger.warning("Email service is not configured. Could not send email.");
            return;
        }

        if (to == null || subject == null || body == null) {
            logger.warning("Missing email parameters (to, subject, or body is null).");
            return;
        }

        try {
            MimeMessage message = javaMailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(fEmail);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(body, true);

            if (attachmentFilename != null && attachmentData != null) {
                helper.addAttachment(attachmentFilename, new ByteArrayResource(attachmentData));
            }

            javaMailSender.send(message);
            logger.info("Email sent successfully to: " + to);

        } catch (MessagingException e) {
            logger.severe("Failed to send email to " + to + ": " + e.getMessage());
        }
    }

    @Async
    public void sendSimpleEmail(String to, String subject, String body) {
        sendEmailWithAttachment(to, subject, body, null, null);
    }
}
