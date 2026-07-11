@echo off
setlocal
set REPO=repos/xamdxlonewolf/apex_pilot
set D=c:\Users\mikec\Documents\programming\apex_pilot\apex_pilot\.scratch\ui-overhaul\deps

call :dep 28 b26
call :dep 29 b26
call :dep 29 b27
call :dep 30 b26
call :dep 30 b28
call :dep 31 b30
call :dep 32 b26
call :dep 32 b28
call :dep 33 b32
call :dep 34 b26
call :dep 34 b28
call :dep 35 b34
call :dep 36 b26
call :dep 36 b28
call :dep 36 b31
call :dep 36 b34
call :dep 37 b26
call :dep 37 b28
call :dep 38 b37
call :dep 39 b26
call :dep 39 b28
call :dep 39 b36
call :dep 40 b39
call :dep 41 b26
call :dep 41 b27
call :dep 42 b30
call :dep 42 b31
echo ALL_DEPS_DONE
exit /b 0

:dep
echo Linking #%1 blocked by %2
gh api --method POST %REPO%/issues/%1/dependencies/blocked_by --input "%D%\%2.json" >nul
if errorlevel 1 echo FAILED %1 %2
exit /b 0
