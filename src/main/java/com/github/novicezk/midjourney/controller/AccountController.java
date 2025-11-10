package com.github.novicezk.midjourney.controller;

import com.github.novicezk.midjourney.domain.DiscordAccount;
import com.github.novicezk.midjourney.loadbalancer.DiscordInstance;
import com.github.novicezk.midjourney.loadbalancer.DiscordLoadBalancer;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import io.swagger.annotations.ApiParam;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Api(tags = "Account Query")
@RestController
@RequestMapping("/account")
@RequiredArgsConstructor
public class AccountController {
	private final DiscordLoadBalancer loadBalancer;

	@ApiOperation(value = "Get Account by ID")
	@GetMapping("/{id}/fetch")
	public DiscordAccount fetch(@ApiParam(value = "Account ID") @PathVariable String id) {
		DiscordInstance instance = this.loadBalancer.getDiscordInstance(id);
		return instance == null ? null : instance.account();
	}

	@ApiOperation(value = "Query All Accounts")
	@GetMapping("/list")
	public List<DiscordAccount> list() {
		return this.loadBalancer.getAllInstances().stream().map(DiscordInstance::account).toList();
	}
}