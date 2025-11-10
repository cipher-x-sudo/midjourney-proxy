package com.github.novicezk.midjourney.enums;


public enum MessageType {
	/**
	 * Create.
	 */
	CREATE,
	/**
	 * Update.
	 */
	UPDATE,
	/**
	 * Delete.
	 */
	DELETE;

	public static MessageType of(String type) {
		return switch (type) {
			case "MESSAGE_CREATE" -> CREATE;
			case "MESSAGE_UPDATE" -> UPDATE;
			case "MESSAGE_DELETE" -> DELETE;
			default -> null;
		};
	}
}
