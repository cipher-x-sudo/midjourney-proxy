package com.github.novicezk.midjourney.dto;

import io.swagger.annotations.ApiModel;
import lombok.Data;

import java.util.List;

@Data
@ApiModel("Task Query Parameters")
public class TaskConditionDTO {

	private List<String> ids;

}
