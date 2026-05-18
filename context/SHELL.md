# Shell Environment

- **OS**: Windows (Windows_NT)
- **Default Shell**: PowerShell
- **Shell Version**: 5.1.26100.8457
- **Print `$PATH`**: `$env:PATH -split ';'`

## Notes

- Use `;` to chain commands (the `&&` operator is not supported in PS 5.1).
- Access environment variables with `$env:VAR_NAME`.
- Use `curl.exe` explicitly for HTTP requests (`curl` is an alias for `Invoke-WebRequest`).
- Use `Remove-Item -Recurse -Force` for recursive deletion.
