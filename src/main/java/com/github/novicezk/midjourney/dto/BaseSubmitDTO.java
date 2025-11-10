package com.github.novicezk.midjourney.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public abstract class BaseSubmitDTO {

	protected String state;

	protected String notifyHook;
}
