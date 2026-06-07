package com.example.notification_service.email;

import com.example.notification_service.messaging.ReservationConfirmedEvent;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

@Service
public class EmailService {

    private static final DateTimeFormatter WHEN_FMT =
            DateTimeFormatter.ofPattern("EEE, d MMM yyyy 'at' HH:mm", Locale.ENGLISH);

    private final JavaMailSender mailSender;
    private final TemplateEngine templateEngine;
    private final QrCodeGenerator qrCodeGenerator;
    private final String from;
    private final ZoneId displayZone;

    public EmailService(JavaMailSender mailSender,
                        TemplateEngine templateEngine,
                        QrCodeGenerator qrCodeGenerator,
                        @Value("${app.mail.from:no-reply@eventplatform.local}") String from,
                        @Value("${app.mail.display-zone:UTC}") String displayZone) {
        this.mailSender = mailSender;
        this.templateEngine = templateEngine;
        this.qrCodeGenerator = qrCodeGenerator;
        this.from = from;
        this.displayZone = ZoneId.of(displayZone);
    }

    public void sendReservationConfirmation(ReservationConfirmedEvent event) {
        if (!StringUtils.hasText(event.userEmail())) {
            // No address to send to — nothing we can do; drop rather than endlessly requeue.
            return;
        }
        try {
            byte[] qrPng = qrCodeGenerator.toPng(event.qrToken(), 300);

            Context ctx = new Context();
            ctx.setVariable("name", StringUtils.hasText(event.userName()) ? event.userName() : "there");
            ctx.setVariable("eventTitle", event.eventTitle());
            ctx.setVariable("eventLocation", event.eventLocation());
            ctx.setVariable("eventWhen", event.eventStartAt() == null ? ""
                    : WHEN_FMT.format(event.eventStartAt().atZone(displayZone)));
            ctx.setVariable("quantity", event.quantity());
            String html = templateEngine.process("reservation-confirmed", ctx);

            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(from);
            helper.setTo(event.userEmail());
            helper.setSubject("Your ticket for " + event.eventTitle());
            helper.setText(html, true);
            helper.addInline("qr", new ByteArrayResource(qrPng), "image/png");

            mailSender.send(message);
        } catch (MessagingException e) {
            throw new IllegalStateException("Failed to send reservation confirmation email", e);
        }
    }
}
