# Agent Instructions for Scripture Habit (Windows)

This project is running on **Windows**. All terminal commands MUST use Windows-specific syntax for `cmd.exe`.

## Command Mapping Rules
- **DO NOT** use `ls`. Use `dir`.
- **DO NOT** use `rm -rf`. Use `rmdir /s /q` for directories or `del` for files.
- **DO NOT** use `cp`. Use `copy` or `xcopy`.
- **DO NOT** use `mv`. Use `move`.
- **DO NOT** use `mkdir -p`. Use `mkdir` (which creates parent directories automatically in Windows if needed).
- **DO NOT** use `/` as path separators in commands. Use `\` where appropriate, though many modern tools accept both.
- **DO NOT** use `cat`. Use `type`.
- **DO NOT** use `touch`. Use `type nul > filename` or `echo. > filename`.

## Environment
- OS: Windows
- Shell: cmd
- Character Encoding: UTF-8 (generally, but be aware of Windows defaults)
