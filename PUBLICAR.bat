@echo off
chcp 65001 >nul
title Publicar Agenda Pro - Vercel
cd /d C:\agenda-pro

echo ============================================
echo   PUBLICAR AGENDA PRO NO VERCEL
echo ============================================
echo.
echo  Este comando publica a versao atual do site
echo  (NAO mexe no GitHub, so no Vercel).
echo.
echo  Se nunca logou aqui: rode antes o comando
echo      vercel login
echo  em outra janela do prompt.
echo.
pause

vercel --prod

echo.
if errorlevel 1 (
  echo  Erro ao publicar. Verifique as mensagens acima.
) else (
  echo  SUCCESSO! O site foi atualizado.
)
pause