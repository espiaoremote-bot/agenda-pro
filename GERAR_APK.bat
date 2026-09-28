@echo off
chcp 65001 >nul
title Gerar APK - Agenda Pro
cd /d C:\agenda-pro

echo ============================================
echo   GERADOR DE APK - AGENDA PRO
echo ============================================
echo.
echo  Passo 1/3: compilando o site...
call npm run build
if errorlevel 1 goto erro

echo  Passo 2/3: sincronizando com o app Android...
call npx cap sync android
if errorlevel 1 goto erro

echo  Passo 3/3: gerando o APK (pode demorar 1-2 min)...
set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot"
set "ANDROID_HOME=C:\Android\sdk"
set "ANDROID_SDK_ROOT=C:\Android\sdk"
cd android
call gradlew.bat --no-daemon assembleDebug
if errorlevel 1 goto erro
cd ..

copy /y "android\app\build\outputs\apk\debug\app-debug.apk" "C:\Users\JuniorThug\Desktop\Agenda-Pro.apk" >nul

echo.
echo ============================================
echo   PRONTO! APK copiado para a Area de Trabalho:
echo   C:\Users\JuniorThug\Desktop\Agenda-Pro.apk
echo ============================================
pause
exit /b 0

:erro
echo.
echo  ERRO durante a geracao. Verifique as mensagens acima.
pause