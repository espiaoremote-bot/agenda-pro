package com.agendapro.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        criarCanalAgendamentos();
    }

    /**
     * Cria o canal de notificacoes de agendamento DIRETO no codigo nativo.
     * Assim garantimos som + padrao de vibracao explicito (0ms espera,
     * 500ms vibra, 250ms pausa, 500ms vibra) e importancia maxima.
     * Como canais do Android "travam" apos criados, usamos um id novo
     * ("agendamentos_v3") para que o padrao de vibracao seja aplicado.
     */
    private void criarCanalAgendamentos() {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) {
            return;
        }

        Uri som = Settings.System.DEFAULT_NOTIFICATION_URI;
        AudioAttributes audio = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .build();

        NotificationChannel canal = new NotificationChannel(
                "agendamentos_v3",
                "Agendamentos",
                NotificationManager.IMPORTANCE_HIGH
        );
        canal.setDescription("Avisos de novos agendamentos e confirmacoes");
        canal.enableLights(true);
        canal.setLightColor(0xFF6200EE);
        canal.enableVibration(true);
        canal.setVibrationPattern(new long[]{0, 500, 250, 500});
        canal.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        canal.setSound(som, audio);

        manager.createNotificationChannel(canal);
    }
}

