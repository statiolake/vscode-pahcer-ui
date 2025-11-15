export const assertNever = (value: never, message?: string): never => {
	throw new Error(message ?? `This value must be handled: ${value}`);
};
