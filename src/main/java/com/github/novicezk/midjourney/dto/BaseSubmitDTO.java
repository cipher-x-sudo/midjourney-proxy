package com.github.novicezk.midjourney.dto;

import io.swagger.annotations.ApiModelProperty;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public abstract class BaseSubmitDTO {

	@ApiModelProperty("Custom parameters")
	protected String state;

	@ApiModelProperty("Callback address, use global notifyHook when empty")
	protected String notifyHook;
}
