export function asErrnoException(error: Error): NodeJS.ErrnoException {
	return error;
}
