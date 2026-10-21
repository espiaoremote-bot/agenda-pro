@echo off
setlocal
chcp 65001 >nul
title Gerar APK - Agenda Pro
set "PROJECT_DIR=%~dp0"
set "APK_PUBLIC=%PROJECT_DIR%public\agenda-pro.apk"
set "APK_SOURCE=%PROJECT_DIR%android\app\build\outputs\apk\debug\app-debug.apk"
set "APK_DOWNLOAD=%USERPROFILE%\Desktop\Agenda-Pro.apk"

pushd "%PROJECT_DIR%"

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

rem O APK fica em public/ para ser baixado do site. Como o Vite copia
rem public/ para dist/ e o Capacitor embute dist/ no app, o APK acabaria
rem dentro de si mesmo (dobrando o tamanho). Por isso removemos a copia
rem dos assets do Android ANTES de compilar o APK.
if exist "%PROJECT_DIR%android\app\src\main\assets\public\agenda-pro.apk" (
  del /f /q "%PROJECT_DIR%android\app\src\main\assets\public\agenda-pro.apk" >nul
)

echo  Passo 3/3: gerando o APK (pode demorar 1-2 min)...
set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot"
set "ANDROID_HOME=C:\Android\sdk"
set "ANDROID_SDK_ROOT=C:\Android\sdk"
pushd android
call gradlew.bat --no-daemon --console=plain assembleDebug
if errorlevel 1 goto erro
popd

copy /y "%APK_SOURCE%" "%APK_DOWNLOAD%" >nul
if errorlevel 1 goto erro
copy /y "%APK_SOURCE%" "%APK_PUBLIC%" >nul
if errorlevel 1 goto erro
popd

echo.
echo ============================================
echo   PRONTO! APK copiado para a Area de Trabalho:
echo   %APK_DOWNLOAD%
echo ============================================
pause
endlocal
exit /b 0

:erro
cd /d "%PROJECT_DIR%"
if exist "%PROJECT_DIR%android\app\build\outputs\apk\debug\app-debug.apk" echo O APK antigo foi preservado para download.
echo.
echo  ERRO durante a geracao. Verifique as mensagens acima.
pause
endlocal
exit /b 1