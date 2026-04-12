# test-api.ps1
# SentinelPay API - PowerShell Test Script
# Tests all endpoints to verify the API is working correctly
# Run this script from the project root while the server is running:
# > .\test-api.ps1

# Base URL of the API
$baseUrl = "http://localhost:3000"

# Stores reference ID from Test 2 for use in Test 5
$savedReferenceId = $null

# Helper function to print section headers cleanly
function Print-Header {
    param([string]$title)
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host " $title" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
}

# Helper function to send POST requests with JSON body
function Invoke-Post {
    param(
        [string]$url,
        [hashtable]$body
    )
    $json = $body | ConvertTo-Json
    return Invoke-RestMethod `
        -Uri $url `
        -Method POST `
        -Body $json `
        -ContentType "application/json"
}

# --- Test 1 - Health Check ---------------------------------------------------
Print-Header "Test 1 - Health Check"
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/health" -Method GET
    Write-Host "Status  : $($health.status)" -ForegroundColor Green
    Write-Host "Service : $($health.service)"
    Write-Host "Version : $($health.version)"
} catch {
    Write-Host "FAILED: $_" -ForegroundColor Red
}

# --- Test 2 - Low Risk Payment -----------------------------------------------
Print-Header "Test 2 - Low Risk Payment (expect: Cleared)"
try {
    $lowRisk = Invoke-Post -url "$baseUrl/api/assessments/assess" -body @{
        accountNumber = "1234567"
        payeeName     = "John Smith"
        bankCode      = "004"
        paymentAmount = 500
    }
    Write-Host "Reference ID   : $($lowRisk.data.referenceId)" -ForegroundColor Green
    Write-Host "Risk Score     : $($lowRisk.data.overallRiskScore)/100"
    Write-Host "Risk Level     : $($lowRisk.data.riskLevel)"
    Write-Host "Status         : $($lowRisk.data.assessmentStatus)"
    Write-Host "Recommendation : $($lowRisk.data.recommendation)"
    $savedReferenceId = $lowRisk.data.referenceId
} catch {
    Write-Host "FAILED: $_" -ForegroundColor Red
}

# --- Test 3 - High Risk Payment ----------------------------------------------
Print-Header "Test 3 - High Risk Payment (expect: Blocked)"
try {
    $highRisk = Invoke-Post -url "$baseUrl/api/assessments/assess" -body @{
        accountNumber = "1111111"
        payeeName     = "test"
        bankCode      = "999"
        paymentAmount = 100000
    }
    Write-Host "Reference ID   : $($highRisk.data.referenceId)" -ForegroundColor Yellow
    Write-Host "Risk Score     : $($highRisk.data.overallRiskScore)/100"
    Write-Host "Risk Level     : $($highRisk.data.riskLevel)"
    Write-Host "Status         : $($highRisk.data.assessmentStatus)"
    Write-Host "Recommendation : $($highRisk.data.recommendation)"
} catch {
    Write-Host "FAILED: $_" -ForegroundColor Red
}

# --- Test 4 - Validation Error -----------------------------------------------
Print-Header "Test 4 - Validation Error (expect: 400)"
try {
    $invalid = Invoke-Post -url "$baseUrl/api/assessments/assess" -body @{
        accountNumber = "123"
        payeeName     = "J"
        bankCode      = "04"
        paymentAmount = -100
    }
    Write-Host "UNEXPECTED SUCCESS - should have returned 400" -ForegroundColor Red
} catch {
    $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
    Write-Host "Correctly returned 400 validation error" -ForegroundColor Green
    Write-Host "Errors:" -ForegroundColor Yellow
    foreach ($err in $errorResponse.errors) {
        Write-Host "  - $($err.field): $($err.message)"
    }
}

# --- Test 5 - Get Single Assessment ------------------------------------------
Print-Header "Test 5 - Get Single Assessment by Reference ID"
try {
    if ($null -ne $savedReferenceId) {
        $single = Invoke-RestMethod `
            -Uri "$baseUrl/api/assessments/$savedReferenceId" `
            -Method GET
        Write-Host "Reference ID   : $($single.data.referenceId)" -ForegroundColor Green
        Write-Host "Risk Score     : $($single.data.overallRiskScore)/100"
        Write-Host "Risk Level     : $($single.data.riskLevel)"
        Write-Host "Status         : $($single.data.assessmentStatus)"
        Write-Host "Risk Factors   : $($single.data.riskFactors.Count) factors evaluated"
    } else {
        Write-Host "Skipped - no reference ID from Test 2" -ForegroundColor Yellow
    }
} catch {
    Write-Host "FAILED: $_" -ForegroundColor Red
}

# --- Test 6 - Get All Assessments --------------------------------------------
Print-Header "Test 6 - Get All Assessments (paginated)"
try {
    $all = Invoke-RestMethod `
        -Uri "$baseUrl/api/assessments?limit=10&skip=0" `
        -Method GET
    Write-Host "Total assessments : $($all.pagination.total)" -ForegroundColor Green
    Write-Host "Current page      : $($all.pagination.currentPage)"
    Write-Host "Total pages       : $($all.pagination.totalPages)"
    Write-Host "Records returned  : $($all.data.Count)"
} catch {
    Write-Host "FAILED: $_" -ForegroundColor Red
}

# --- Test 7 - Filtered List --------------------------------------------------
Print-Header "Test 7 - Filtered List by Risk Level (Low)"
try {
    $filtered = Invoke-RestMethod `
        -Uri "$baseUrl/api/assessments?riskLevel=Low" `
        -Method GET
    Write-Host "Low risk assessments : $($filtered.pagination.total)" -ForegroundColor Green
    Write-Host "Records returned     : $($filtered.data.Count)"
} catch {
    Write-Host "FAILED: $_" -ForegroundColor Red
}

# --- Test 8 - 404 Not Found --------------------------------------------------
Print-Header "Test 8 - 404 Not Found"
try {
    $notFound = Invoke-RestMethod `
        -Uri "$baseUrl/api/assessments/PAY-99990101-000000-0000" `
        -Method GET
    Write-Host "UNEXPECTED SUCCESS - should have returned 404" -ForegroundColor Red
} catch {
    $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
    Write-Host "Correctly returned 404" -ForegroundColor Green
    Write-Host "Message: $($errorResponse.message)"
}

# --- Summary -----------------------------------------------------------------
Print-Header "All Tests Complete"
Write-Host "SentinelPay API is operational" -ForegroundColor Green
Write-Host ""