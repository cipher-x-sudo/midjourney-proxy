package com.github.novicezk.midjourney.dto;

import lombok.Data;
import lombok.EqualsAndHashCode;

import java.util.List;


@Data
@EqualsAndHashCode(callSuper = true)
public class SubmitImagineDTO extends BaseSubmitDTO {

	private String prompt;

	private List<String> base64Array;

	@Deprecated(since = "3.0", forRemoval = true)
	private String base64;

}
