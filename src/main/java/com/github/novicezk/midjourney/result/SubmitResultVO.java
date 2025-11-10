package com.github.novicezk.midjourney.result;

import lombok.Data;

import java.util.HashMap;
import java.util.Map;

@Data
public class SubmitResultVO {

	private int code;

	private String description;

	private String result;

	private Map<String, Object> properties = new HashMap<>();

	public SubmitResultVO setProperty(String name, Object value) {
		this.properties.put(name, value);
		return this;
	}

	public SubmitResultVO removeProperty(String name) {
		this.properties.remove(name);
		return this;
	}

	public Object getProperty(String name) {
		return this.properties.get(name);
	}

	@SuppressWarnings("unchecked")
	public <T> T getPropertyGeneric(String name) {
		return (T) getProperty(name);
	}

	public <T> T getProperty(String name, Class<T> clz) {
		return clz.cast(getProperty(name));
	}

	public static SubmitResultVO of(int code, String description, String result) {
		return new SubmitResultVO(code, description, result);
	}

	public static SubmitResultVO fail(int code, String description) {
		return new SubmitResultVO(code, description, null);
	}

	private SubmitResultVO(int code, String description, String result) {
		this.code = code;
		this.description = description;
		this.result = result;
	}
}
