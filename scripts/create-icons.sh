#!/bin/bash

# Script for Mac OS X to resize an image using sips  

input_path="original/bell-bolt.png"
output_path="../static/icons"

# Resize the image to multiple sizes
sips -Z 16 $input_path --out "$output_path/icon-16.png"
sips -Z 32 $input_path --out "$output_path/icon-32.png"
sips -Z 48 $input_path --out "$output_path/icon-48.png"
sips -Z 128 $input_path --out "$output_path/icon-128.png"

