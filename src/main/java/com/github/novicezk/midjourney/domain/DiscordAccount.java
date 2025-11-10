package com.github.novicezk.midjourney.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.github.novicezk.midjourney.Constants;
import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@ApiModel("Discord Account")
public class DiscordAccount extends DomainObject {

	@ApiModelProperty("Guild ID")
	private String guildId;
	@ApiModelProperty("Channel ID")
	private String channelId;
	@ApiModelProperty("User Token")
	private String userToken;
	@ApiModelProperty("User UserAgent")
	private String userAgent = Constants.DEFAULT_DISCORD_USER_AGENT;

	@ApiModelProperty("Is available")
	private boolean enable = true;

	@ApiModelProperty("Concurrency")
	private int coreSize = 3;
	@ApiModelProperty("Queue length")
	private int queueSize = 10;
	@ApiModelProperty("Task timeout (minutes)")
	private int timeoutMinutes = 5;

	@JsonIgnore
	public String getDisplay() {
		return this.channelId;
	}
}
