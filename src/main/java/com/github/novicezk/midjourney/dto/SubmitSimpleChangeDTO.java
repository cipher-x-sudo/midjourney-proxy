package com.github.novicezk.midjourney.dto;

import lombok.Data;
import lombok.EqualsAndHashCode;


@Data
@EqualsAndHashCode(callSuper = true)
public class SubmitSimpleChangeDTO extends BaseSubmitDTO {

	private String content;

}
